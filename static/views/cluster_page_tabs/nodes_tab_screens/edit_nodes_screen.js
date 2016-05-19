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
import utils from 'utils';
import NodeListScreen from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';
import {Sorter} from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen_objects';

var EditNodesScreen = React.createClass({
  statics: {
    fetchData(options) {
      var {cluster} = options;
      var nodes = utils.getNodeListFromTabOptions(options);

      if (!nodes) {
        return $.Deferred().reject();
      }

      nodes.fetch = function(options) {
        return this.constructor.__super__.fetch.call(this,
          _.extend({data: {cluster_id: cluster.id}}, options));
      };
      nodes.parse = function() {
        return this.getByIds(nodes.map('id'));
      };
      return $.when(
        cluster.get('roles').fetch(),
        cluster.get('settings').fetch({cache: true})
      ).then(() => ({nodes}));
    }
  },
  getInitialState() {
    var {cluster, nodes} = this.props;

    var defaultSorting = [{roles: 'asc'}];
    var activeSorters = _.map(defaultSorting, _.partial(Sorter.fromObject, _, false));

    var roles = cluster.get('roles').pluck('name');
    var selectedRoles = _.filter(roles,
      (role) => nodes.every((node) => node.hasRole(role))
    );
    var indeterminateRoles = _.filter(roles,
      (role) => !_.includes(selectedRoles, role) && nodes.some((node) => node.hasRole(role))
    );

    var viewMode = cluster.get('ui_settings').view_mode;

    var configModels = {
      cluster,
      settings: cluster.get('settings'),
      version: app.version,
      default: cluster.get('settings')
    };

    return {
      viewMode,
      defaultSorting,
      activeSorters,
      selectedRoles,
      indeterminateRoles,
      configModels
    };
  },
  changeViewMode(viewMode) {
    this.setState({viewMode});
    this.props.updateUISettings('view_mode', viewMode);
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
    return (
      <NodeListScreen
        {... _.omit(this.props, 'screenOptions')}
        {... this.state}
        ref='screen'
        mode='edit'
        roles={this.props.cluster.get('roles')}
        nodeNetworkGroups={this.props.cluster.get('nodeNetworkGroups')}
        showRolePanel
        changeViewMode={this.changeViewMode}
        selectRoles={this.selectRoles}
      />
    );
  }
});

export default EditNodesScreen;
