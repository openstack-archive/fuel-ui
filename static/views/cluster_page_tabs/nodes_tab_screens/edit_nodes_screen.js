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
import $ from 'jquery';
import _ from 'underscore';
import React from 'react';
import models from 'models';
import utils from 'utils';
import NodeListScreen from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';

var EditNodesScreen = React.createClass({
  statics: {
    loadProps(params, cb) {
      var id = Number(params.params.id);
      var cluster = new models.Cluster({id: id});
      var baseUrl = _.result(cluster, 'url');

      var roles = new models.Roles();
      roles.url = baseUrl + '/roles';
      cluster.set({roles});

      var nodes = new models.Nodes();
      nodes.fetch = utils.fetchClusterProperties(id);
      cluster.set({nodes});

      return $.when(
        cluster.get('roles').fetch(),
        cluster.get('nodes').fetch()
      )
        .then(() => {
          var selectedNodes = utils.getNodeListFromTabOptions(params.params.options, cluster);
          if (!selectedNodes) {
            return $.Deferred().reject();
          }
          selectedNodes.fetch = utils.fetchClusterProperties(id);
          selectedNodes.parse = function() {
            return this.getByIds(nodes.map('id'));
          };
          cb(null, {nodes: selectedNodes})
        });
    }
  },
  render() {
    console.log('Edit nodes props:', this.props);
    return (
      <NodeListScreen
        {... _.omit(this.props, 'screenOptions')}
        ref='screen'
        mode='edit'
        nodeNetworkGroups={this.props.cluster.get('nodeNetworkGroups')}
        showRolePanel
        defaultFilters={{}}
        defaultSorting={[{roles: 'asc'}]}
      />
    );
  }
});

export default EditNodesScreen;
