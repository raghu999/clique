# Clique
Graph editor library/application

**Clique** is a library for processing social network graphs, using *adapters*
to load in graph data from any source, a client application (such as the example
application included in this repository) to explore, manipulate, and annotate
the graph, and the adapters' ability to perform *writebacks* to save the updated
graph for later use.

This document contains some information about Clique's API.

## Clique API

Clique has two major components:  a ``Graph`` class to explore and annotate a
social network graph (implemented as a [Backbone](http://backbonejs.org/)
model), and an ``Adapter`` API which can be implemented to provide a path from
any source of graph data into the format required by ``Graph`` to do its work.

### ``Graph`` class

``Graph`` is a JavaScript class with the following properties and methods:

- ``new Graph(options)`` - Unlike an ordinary Backbone model, the ``Graph``
  constructor does not take an object describing the initial model attributes,
  but only an ``options`` object containing the following properties:

  - ``adapter`` - a graph data adapter object.

- ``addNeighborhood(options)`` - This method queries the adapter for the graph
  neighborhood described by ``options``, and blends that subgraph into the
  ``Graph``'s current view of the network.  The ``options`` object should contain
  at least a ``center`` property identifying a node in the graph, and the
  ``radius`` property, which specifies how many hops out to go from the center.
  Any other properties of the ``options`` object are bound by the particular
  adapter associated with this ``Graph`` instance.

- ``removeNeighborhood(options)`` - This method removes the neighborhood
  specified by ``options.center`` and ``options.radius`` from the ``Graph``'s
  view of the graph.  This includes both the nodes and links making up the
  neighborhood itself, as well as any links connecting the outermost nodes of the
  neighborhood to the rest of the current view of the graph, if any.  Setting
  ``options.radius`` to ``0`` will cause just the center node to be removed in
  this manner.

### Adapter API

An adapter, in the context of Clique, is any JavaScript object that contains the
following methods:

- ``findNodes(spec)`` - returns a jQuery Deferred object that will resolve with
  a list of node mutator objects matching the ``spec``, which itself is an
object of key-value pairs describing the sought pattern from the set of nodes.

- ``findNode(spec)`` - returns a jQuery Deferred object that will resolve with a
  single node matching ``spec``, or ``undefined`` if there is no such node.
  This is a convenience function that can be implemented in a general way simply
  by returning ``this.findNodes()[0]``, but if there is a more efficient way to
  compute the result, this method can provide it.

- ``neighborhood(options)`` - returns a jQuery Deferred object that will resolve
  with a subgraph consisting of the node ``options.center``, and all nodes lying
  within distance ``options.radius`` of it.  Typically, ``options.center`` would
  be supplied via a call to ``findNodes()`` or ``findNode()``.  This method, by
  default, will not include any nodes with a ``deleted`` property set to true; to
  include these nodes, ``options.deleted`` can be set to ``true``.  The subgraph
  should be an object with two properties: ``nodes``, containing a list of nodal
  data objects (which must contain at least a unique ``key`` property); and
  ``links``, containing a list of objects with a ``source`` and ``target``
  property, each of which contains a key identifying one of the nodes.

- ``sync()`` - causes the original source of the graph data to become
  synchronized with any changes made to the graph since loading.  Only changes
  made to the ``data`` property of the nodes will be written back to the store.
  For example, the ``x`` and ``y`` properties used by
  [Cola](http://marvl.infotech.monash.edu/webcola/) would not be written back, nor
  any properties installed by the view to the node's top-level for purposes of
  controlling rendering, etc.  Returns a jQuery Deferred object that can have
  further actions chained to it.
