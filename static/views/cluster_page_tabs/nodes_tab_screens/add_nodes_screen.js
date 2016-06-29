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
import {NODE_LIST_SORTERS, NODE_LIST_FILTERS} from 'consts';
import models from 'models';
import NodeListScreen from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';

var AddNodesScreen = React.createClass({
  statics: {
    fetchData({cluster}) {
      var nodes = new models.Nodes();
      nodes.fetch = function(options) {
        return this.constructor.__super__.fetch.call(this, _.extend({data: {cluster_id: ''}},
          options));
      };
      return Promise.all([
        nodes.fetch(),
        cluster.get('roles').fetch(),
        cluster.get('settings').fetch({cache: true})
      ]).then(() => ({nodes}));
    }
  },
  render() {
    return <NodeListScreen
      {... _.omit(this.props, 'screenOptions')}
      ref='screen'
      mode='add'
      nodeNetworkGroups={this.props.cluster.get('nodeNetworkGroups')}
      showRolePanel
      statusesToFilter={['discover', 'error', 'offline', 'removing']}
      availableFilters={_.without(NODE_LIST_FILTERS, 'cluster', 'roles', 'group_id')}
      availableSorters={_.without(NODE_LIST_SORTERS, 'cluster', 'roles', 'group_id')}
    />;
  }
});

export default AddNodesScreen;
