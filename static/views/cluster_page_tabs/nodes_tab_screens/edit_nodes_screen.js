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
import utils from 'utils';
import NodeListScreen from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';

var EditNodesScreen = React.createClass({
  statics: {
    fetchData(options) {
      var {cluster} = options;
      var nodes = utils.getNodeListFromTabOptions(options, cluster);

      if (!nodes) {
        return Promise.reject();
      }

      nodes.parse = function() {
        return this.getByIds(nodes.map('id'));
      };
      return Promise.all([
        cluster.get('roles').fetch(),
        cluster.get('settings').fetch({cache: true})
      ]).then(() => ({nodes}));
    }
  },
  render() {
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
