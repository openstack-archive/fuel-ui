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
import nodeListMixin from 'views/cluster_page_tabs/nodes_tab_screens/node_list_mixin';

var AddNodesScreen = React.createClass({
  mixins: [nodeListMixin],
  statics: {
    fetchData({cluster}) {
      var nodes = new models.Nodes();
      nodes.fetch = function(options) {
        return this.constructor.__super__.fetch.call(this, _.extend({data: {cluster_id: ''}},
          options));
      };
      return $.when(
        nodes.fetch(),
        cluster.get('roles').fetch(),
        cluster.get('settings').fetch({cache: true})
      ).then(() => ({nodes}));
    }
  },
  getInitialState() {
    var {cluster} = this.props;
    return _.extend(
      this.getNodeListStates(),
      {
        selectedRoles: [],
        indeterminateRoles: [],
        configModels: {
          cluster,
          settings: cluster.get('settings'),
          version: app.version,
          default: cluster.get('settings')
        }
      }
    );
  },
  getDefaultProps() {
    return {
      defaultFilters: {status: []},
      statusesToFilter: _.without(models.Node.prototype.statuses,
        'ready',
        'pending_addition',
        'pending_deletion',
        'provisioned',
        'provisioning',
        'deploying',
        'stopped'
      ),
      availableFilters: _.without(models.Nodes.prototype.filters,
        'cluster',
        'roles',
        'group_id'
      ),
      defaultSorting: [{status: 'asc'}],
      availableSorters: _.without(models.Nodes.prototype.sorters,
        'cluster',
        'roles',
        'group_id'
      )
    };
  },
  selectRoles(role, checked) {
    var {selectedRoles, indeterminateRoles} = this.state;
    if (checked) {
      selectedRoles.push(role);
    } else {
      selectedRoles = _.without(selectedRoles, role);
    }
    indeterminateRoles = _.without(indeterminateRoles, role);
    this.setState({selectedRoles, indeterminateRoles});
  },
  render() {
    var {cluster} = this.props;
    return <NodeListScreen
      {... _.omit(this.props, 'screenOptions')}
      {... _.pick(this.state, 'selectedRoles', 'indeterminateRoles', 'configModels')}
      {... this.getNodeListProps()}
      ref='screen'
      mode='add'
      nodeNetworkGroups={cluster.get('nodeNetworkGroups')}
      roles={cluster.get('roles')}
      selectRoles={this.selectRoles}
      showRolePanel
    />;
  }
});

export default AddNodesScreen;
