(function (clique, _, Backbone, $) {
    "use strict";

    clique.adapter = {};

    clique.Adapter = function (options) {
        var mutators;

        // Keep track of mutators.
        this.mutators = mutators = {};
        this.onNewMutator = this.onNewMutator || _.noop;
        this.addMutator = function (blob) {
            var mut;

            if (!_.has(mutators, blob.key)) {
                mutators[blob.key] = new clique.util.Mutator(blob);
                this.onNewMutator(mut);
            }

            mut = mutators[blob.key];

            return mut;
        };

        // Define methods.
        this.getMutator = _.propertyOf(mutators);

        this.findNodes = function (spec) {
            return $.when(this.findNodesImpl(spec)).then(_.partial(_.map, _, this.addMutator, this));
        };

        this.findNode = function (spec) {
            return $.when(this.findNodesImpl(spec)).then(_.bind(function (results) {
                if (_.isEmpty(results)) {
                    return undefined;
                }

                return this.addMutator(results[0]);
            }, this));
        };

        this.findNodeByKey = function (key) {
            return this.findNode({
                key: key
            });
        };

        this.findLinks = function (_spec) {
            var spec = clique.util.deepCopy(_spec),
                undirected = _.isUndefined(spec.undirected) ? true : spec.undirected,
                directed = _.isUndefined(spec.directed) ? true : spec.directed,
                source = spec.source,
                target = spec.target;

            delete spec.undirected;
            delete spec.directed;
            delete spec.source;
            delete spec.target;

            return $.when(this.findLinksImpl(spec, source, target, undirected, directed)).then(_.partial(_.map, _, this.addMutator, this));
        };

        this.findLink = function (spec) {
            return $.when(this.findLinksImpl(spec)).then(_.bind(function (results) {
                if (_.isEmpty(results)) {
                    return undefined;
                }

                return this.addMutator(results[0]);
            }, this));
        };

        this.findLinkByKey = function (key) {
            return this.findLink({
                key: key
            });
        };

        this.getNeighborLinks = function (node, opts) {
            var reqs = [];

            opts = opts || {};
            _.each(["outgoing", "incoming", "undirected"], function (mode) {
                opts[mode] = _.isUndefined(opts[mode]) ? true : opts[mode];
            });

            if (opts.outgoing) {
                reqs.push(this.findLinks({
                    source: node.key(),
                    undirected: false
                }));
            }

            if (opts.incoming) {
                reqs.push(this.findLinks({
                    target: node.key(),
                    undirected: false
                }));
            }

            if (opts.undirected) {
                reqs.push(this.findLinks({
                    source: node.key(),
                    undirected: true
                }));

                reqs.push(this.findLinks({
                    target: node.key(),
                    undirected: true
                }));
            }

            return $.when.apply($, reqs).then(function () {
                return _.reduce(_.toArray(arguments), function (memo, item) {
                    return memo.concat(item);
                }, []);
            });
        };

        this.getOutgoingLinks = function (node) {
            return this.getNeighborLinks(node, {
                outgoing: true,
                incoming: false,
                undirected: false
            });
        };

        this.getOutflowingLinks = function (node) {
            return this.getNeighborLinks(node, {
                outgoing: true,
                incoming: false,
                undirected: true
            });
        };

        this.getIncomingLinks = function (node) {
            return this.getNeighborLinks(node, {
                outgoing: false,
                incoming: true,
                undirected: false
            });
        };

        this.getInflowingLinks = function (node) {
            return this.getNeighborLinks(node, {
                outgoing: false,
                incoming: true,
                undirected: true
            });
        };

        this.getUndirectedLinks = function (node) {
            return this.getNeighborLinks(node, {
                outgoing: false,
                incoming: false,
                undirected: true
            });
        };

        this.getDirectedLinks = function (node) {
            return this.getNeighborLinks(node, {
                outgoing: true,
                incoming: true,
                undirected: false
            });
        };

        this.getNeighbors = function (node, opts) {
            var key = node.key();
            return this.getNeighborLinks(node, opts).then(_.bind(function (links) {
                var neighborKeys,
                    muts;

                neighborKeys = _.map(links, function (link) {
                    return key === link.source() ? link.target() : link.source();
                });

                // Attempt to retrieve the mutators.  The ones we don't have
                // yet will show up as undefined in this array.
                muts = _.map(neighborKeys, this.getMutator, this);

                _.each(muts, function (mut, i) {
                    if (_.isUndefined(mut)) {
                        muts[i] = this.findNodeByKey(neighborKeys[i]);
                    } else {
                        muts[i] = $.when(muts[i]);
                    }
                }, this);

                return $.when.apply($, muts);
            }, this)).then(function () {
                return _.toArray(arguments);
            });
        };

        this.getOutgoingNeighbors = function (node) {
            return this.getNeighbors(node, {
                outgoing: true,
                incoming: false,
                undirected: false
            });
        };

        this.getOutflowingNeighbors = function (node) {
            return this.getNeighbors(node, {
                outgoing: true,
                incoming: false,
                undirected: true
            });
        };

        this.getIncomingNeighbors = function (node) {
            return this.getNeighbors(node, {
                outgoing: false,
                incoming: true,
                undirected: false
            });
        };

        this.getInflowingNeighbors = function (node) {
            return this.getNeighbors(node, {
                outgoing: false,
                incoming: true,
                undirected: true
            });
        };

        this.getUndirectedNeighbors = function (node) {
            return this.getNeighbors(node, {
                outgoing: false,
                incoming: false,
                undirected: true
            });
        };

        this.getDirectedNeighbors = function (node) {
            return this.getNeighbors(node, {
                outgoing: true,
                incoming: true,
                undirected: false
            });
        };

        this.createNode = function (data) {
            return $.when(this.createNodeImpl(data || {}))
                .then(_.bind(this.addMutator, this));
        };

        this.createLink = function (source, target, _data, undirected) {
            var data;

            // If source/target is a mutator, call its key method to get the
            // key; otherwise, assume it is a string describing the key already.
            source = _.result(source, "key", source);
            target = _.result(target, "key", target);

            data = _data || {};
            undirected = _.isUndefined(undirected) ? false : undirected;

            return $.when(this.createLinkImpl(source, target, data, undirected))
                .then(_.bind(this.addMutator, this));
        };

        this.destroyNode = function (node) {
            var key = node.key();
            return this.destroyNodeImpl(key).then(function (response) {
                return {
                    key: key,
                    response: response
                };
            });
        };

        this.destroyLink = function (link) {
            var key = link.key();
            return this.destroyLink(key).then(function (response) {
                return {
                    key: key,
                    response: response
                };
            });
        };

        options = options || {};
        this.initialize.apply(this, arguments);
    };

    clique.Adapter.extend = Backbone.Model.extend;

    clique.adapter.NodeLinkList = clique.Adapter.extend({
        initialize: function (options) {
            var table = {};

            this.nodes = clique.util.deepCopy(options.nodes);
            this.links = clique.util.deepCopy(options.links);

            _.each(this.nodes, function (node, i) {
                var tmpNs = "datax",
                    ns;

                // Promote the data elements into a dedicated namespace.
                //
                // First figure out a suitable temporary name to use for the
                // namespace.
                while (_.has(node, tmpNs)) {
                    tmpNs += "x";
                }

                // Create the namespace.
                ns = node[tmpNs] = {};

                // Move all top-level properties into the namespace.
                _.each(node, function (v, k) {
                    if (k !== tmpNs) {
                        ns[k] = v;
                        delete node[k];
                    }
                });

                // Rename the temporary namespace as "data".
                if (tmpNs !== "data") {
                    node.data = ns;
                    delete node[tmpNs];
                }

                table[i] = node;

                // Assign a unique key to this node.
                node.key = _.uniqueId("node_");
            });

            _.each(this.links, function (link) {
                link.key = _.uniqueId("link_");

                link.source = table[link.source];
                link.target = table[link.target];
            }, this);
        },

        findNodesImpl: function (_spec) {
            var spec = clique.util.deepCopy(_spec),
                searchspace = this.nodes,
                result;

            if (spec.key) {
                searchspace = _.filter(searchspace, function (node) {
                    return node.key === spec.key;
                });

                delete spec.key;
            }

            result = _.filter(searchspace, function (node) {
                return _.isMatch(node.data, spec);
            });

            return result;
        },

        findLinksImpl: function (spec, source, target, undirected, directed) {
            return _.filter(this.links, function (link) {
                var undirectedMatch = (link.undirected || false) === undirected,
                    directedMatch = (_.isUndefined(link.undirected) || !link.undirected) === directed,
                    sourceMatch = _.isUndefined(source) || (link.source.key === source),
                    targetMatch = _.isUndefined(target) || (link.target.key === target),
                    dataMatch = _.isMatch(spec, link.data);

                return _.every([sourceMatch, targetMatch, dataMatch, undirectedMatch, directedMatch]);
            });
        },

        newNode: _.noop,
        newLink: _.noop,
        destroyNode: _.noop,
        destroyLink: _.noop
    });
}(window.clique, window._, window.Backbone, window.jQuery));
