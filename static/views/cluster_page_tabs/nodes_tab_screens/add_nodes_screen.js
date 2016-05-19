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
import {Sorter, Filter} from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen_objects';

var AddNodesScreen = React.createClass({
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
    var {cluster, nodes} = this.props;

    var defaultFilters = {status: []};
    var activeFilters = Filter.fromObject(defaultFilters, false);
    _.invoke(activeFilters, 'updateLimits', nodes, false);

    var defaultSorting = [{status: 'asc'}];
    var activeSorters = _.map(defaultSorting, _.partial(Sorter.fromObject, _, false));

    var selectedRoles = [];
    var indeterminateRoles = [];

    var configModels = {
      cluster,
      settings: cluster.get('settings'),
      version: app.version,
      default: cluster.get('settings')
    };

    return {
      defaultFilters,
      activeFilters,
      defaultSorting,
      activeSorters,
      selectedRoles,
      indeterminateRoles,
      configModels
    };
  },
  updateSearch(search) {
    this.setState({search});
  },
  changeViewMode(viewMode) {
    this.setState({viewMode});
  },
  updateSorting(activeSorters) {
    this.setState({activeSorters});
  },
  updateFilters(activeFilters) {
    this.setState({activeFilters});
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
    var nodes = cluster.get('nodes');

    return <NodeListScreen
      {... _.omit(this.props, 'screenOptions')}
      {...this.state}
      {... _.pick(this,
        'updateSearch', 'changeViewMode', 'updateSorting', 'updateFilters', 'selectRoles'
      )}
      ref='screen'
      mode='add'
      roles={cluster.get('roles')}
      nodeNetworkGroups={cluster.get('nodeNetworkGroups')}
      availableSorters={
        _.without(models.Nodes.prototype.sorters,
          'cluster',
          'roles',
          'group_id'
        ).map((name) => new Sorter(name, 'asc', false))
      }
      availableFilters={
        _.without(models.Nodes.prototype.filters,
          'cluster',
          'roles',
          'group_id'
        ).map((name) => {
          var filter = new Filter(name, [], false);
          filter.updateLimits(nodes, true);
          return filter;
        })
      }
      statusesToFilter={_.without(models.Node.prototype.statuses,
        'ready',
        'pending_addition',
        'pending_deletion',
        'provisioned',
        'provisioning',
        'deploying',
        'stopped'
      )}
      showRolePanel
    />;
  }
});

export default AddNodesScreen;
