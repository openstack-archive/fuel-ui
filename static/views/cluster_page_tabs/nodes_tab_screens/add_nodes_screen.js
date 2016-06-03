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
import NodeListScreen from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';

var AddNodesScreen = React.createClass({
  statics: {
    loadProps(params, cb) {
      console.log(params);
      var id = Number(params.params.id);
      var cluster = new models.Cluster({id: id});
      var baseUrl = _.result(cluster, 'url');
      var clusterDataFetch = (clusterId='') => function(options) {
        return this.constructor.__super__.fetch.call(this,
          _.extend({data: {cluster_id: clusterId}}, options));
      };
      console.log(baseUrl);

      var settings = new models.Settings();
      settings.url = baseUrl + '/attributes';
      cluster.set({settings});
      settings.fetch = clusterDataFetch(id);

      var roles = new models.Roles();
      roles.url = baseUrl + '/roles';
      cluster.set({roles});
      roles.fetch = clusterDataFetch(id);

      var nodes = new models.Nodes();
      nodes.fetch = clusterDataFetch();
      console.log(nodes);

      return $.when(
        nodes.fetch(),
        cluster.get('roles').fetch()
        // cluster.get('settings').fetch({cache: true})
      )
        .then(() => cb(null, {
          nodes: nodes,
          roles: cluster.get('roles'),
          settings: cluster.get('settings')
        }));
    }
  },
  render() {
    return <NodeListScreen {... _.omit(this.props, 'screenOptions')}
      ref='screen'
      mode='add'
      roles={this.props.roles}
      nodeNetworkGroups={this.props.cluster.get('nodeNetworkGroups')}
      sorters={_.without(models.Nodes.prototype.sorters, 'cluster', 'roles', 'group_id')}
      defaultSorting={[{status: 'asc'}]}
      filters={_.without(models.Nodes.prototype.filters, 'cluster', 'roles', 'group_id')}
      statusesToFilter={_.without(models.Node.prototype.statuses,
        'ready',
        'pending_addition',
        'pending_deletion',
        'provisioned',
        'provisioning',
        'deploying',
        'stopped'
      )}
      defaultFilters={{status: []}}
    />;
  }
});

export default AddNodesScreen;
