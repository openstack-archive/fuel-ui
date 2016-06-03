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
import utils from 'utils';
import models from 'models';
import React from 'react';
import {NODE_STATUSES, NODE_LIST_SORTERS, NODE_LIST_FILTERS} from 'consts';
import NodeListScreen from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';

var ClusterNodesScreen = React.createClass({
  statics: {
    loadProps(params, cb) {
      var id = Number(params.params.id);
      var cluster = new models.Cluster({id: id});
      var baseUrl = _.result(cluster, 'url');

      var roles = new models.Roles();
      roles.url = baseUrl + '/roles';
      roles.fetch = utils.fetchClusterProperties(id);

      cluster.get('nodeNetworkGroups').fetch = utils.fetchClusterProperties(id);
      cluster.get('nodes').fetch = utils.fetchClusterProperties(id);

      var release;

      return $.when(
        cluster.fetch(),
        roles.fetch(),
        cluster.fetchRelated('nodes'),
        cluster.fetchRelated('nodeNetworkGroups')
      )
        .then(() => {
          release = new models.Release({id: cluster.get('release_id')});
          release.fetch()
            .then(() => cb(null, {
              roles,
              nodes: cluster.get('nodes'),
              nodeNetworkGroups: cluster.get('nodeNetworkGroups'),
              release
            }));
        });
    }
  },
  getInitialState() {
    if (this.props.cluster) {
      this.props.cluster.set(_.pick(this.props, 'roles', 'nodes', 'nodeNetworkGroups', 'release'));
    }
    return null;
  },
  updateUISettings(name, value) {
    var uiSettings = this.props.cluster.get('ui_settings');
    uiSettings[name] = value;
    this.props.cluster.save({ui_settings: uiSettings}, {patch: true, wait: true, validate: false});
  },
  render() {
    var {cluster} = this.props;
    return <NodeListScreen
      ref='screen'
      {... _.omit(this.props, 'screenOptions')}
      mode='list'
      nodes={cluster.get('nodes')}
      roles={cluster.get('roles')}
      nodeNetworkGroups={cluster.get('nodeNetworkGroups')}
      updateUISettings={this.updateUISettings}
      defaultFilters={{roles: [], status: []}}
      statusesToFilter={_.without(NODE_STATUSES, 'discover')}
      availableFilters={_.without(NODE_LIST_FILTERS, 'cluster')}
      defaultSorting={[{roles: 'asc'}]}
      availableSorters={_.without(NODE_LIST_SORTERS, 'cluster')}
    />;
  }
});

export default ClusterNodesScreen;
