/*
 * Copyright 2014 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
**/
import _ from 'underscore';
import React from 'react';
import models from 'models';
import NodeListScreen from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';
import nodeListMixin from 'views/cluster_page_tabs/nodes_tab_screens/node_list_mixin';

var ClusterNodesScreen = React.createClass({
  mixins: [nodeListMixin],
  getInitialState() {
    return this.getNodeListStates(
      this.props.cluster.get('nodes'),
      this.props.cluster.get('ui_settings')
    );
  },
  getDefaultProps() {
    return {
      defaultFilters: {roles: [], status: []},
      statusesToFilter: _.without(models.Node.prototype.statuses, 'discover'),
      availableFilters: _.without(models.Nodes.prototype.filters, 'cluster'),
      defaultSorting: [{roles: 'asc'}],
      availableSorters: _.without(models.Nodes.prototype.sorters, 'cluster')
    };
  },
  updateUISettings() {
    return this.props.updateUISettings(...arguments);
  },
  render() {
    var {cluster} = this.props;
    var nodes = cluster.get('nodes');
    return <NodeListScreen
      ref='screen'
      {... _.omit(this.props, 'screenOptions', 'updateUISettings')}
      {... this.getNodeListProps(nodes)}
      mode='list'
      nodes={nodes}
      roles={cluster.get('roles')}
      nodeNetworkGroups={cluster.get('nodeNetworkGroups')}
    />;
  }
});

export default ClusterNodesScreen;
