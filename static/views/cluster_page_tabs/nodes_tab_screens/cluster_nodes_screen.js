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
import {Sorter, Filter} from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen_objects';

var ClusterNodesScreen = React.createClass({
  getInitialState() {
    var {cluster} = this.props;
    var {
      filter, filter_by_labels, sort, sort_by_labels, search, view_mode
    } = cluster.get('ui_settings');

    var defaultFilters = {roles: [], status: []};
    var activeFilters = _.union(
        Filter.fromObject(_.extend({}, defaultFilters, filter), false),
        Filter.fromObject(filter_by_labels, true)
      );
    _.invoke(activeFilters, 'updateLimits', cluster.get('nodes'), false);

    var defaultSorting = [{roles: 'asc'}];
    var activeSorters = _.union(
      _.map(sort, _.partial(Sorter.fromObject, _, false)),
      _.map(sort_by_labels, _.partial(Sorter.fromObject, _, true))
    );

    return {
      defaultFilters,
      activeFilters,
      defaultSorting,
      activeSorters,
      search,
      viewMode: view_mode
    };
  },
  updateSearch(search) {
    this.setState({search});
    this.props.updateUISettings('search', _.trim(search));
  },
  changeViewMode(viewMode) {
    this.setState({viewMode});
    this.props.updateUISettings('view_mode', viewMode);
  },
  updateSorting(activeSorters, updateLabelsOnly = false) {
    this.setState({activeSorters});
    var groupedSorters = _.groupBy(activeSorters, 'isLabel');
    if (!updateLabelsOnly) {
      this.props.updateUISettings('sort', _.map(groupedSorters.false, Sorter.toObject));
    }
    this.props.updateUISettings('sort_by_labels', _.map(groupedSorters.true, Sorter.toObject));
  },
  updateFilters(activeFilters, updateLabelsOnly = false) {
    this.setState({activeFilters});
    var groupedFilters = _.groupBy(activeFilters, 'isLabel');
    if (!updateLabelsOnly) {
      this.props.updateUISettings('filter', Filter.toObject(groupedFilters.false));
    }
    this.props.updateUISettings('filter_by_labels', Filter.toObject(groupedFilters.true));
  },
  render() {
    var {cluster} = this.props;
    var nodes = cluster.get('nodes');

    return <NodeListScreen
      ref='screen'
      {... _.omit(this.props, 'screenOptions', 'updateUISettings')}
      {...this.state}
      {... _.pick(this,
        'updateSearch',
        'changeViewMode',
        'updateSorting',
        'updateFilters'
      )}
      mode='list'
      nodes={nodes}
      roles={cluster.get('roles')}
      nodeNetworkGroups={cluster.get('nodeNetworkGroups')}
      availableSorters={
        _.without(models.Nodes.prototype.sorters, 'cluster').map(
          (name) => new Sorter(name, 'asc', false)
        )
      }
      availableFilters={
        _.without(models.Nodes.prototype.filters, 'cluster').map((name) => {
          var filter = new Filter(name, [], false);
          filter.updateLimits(nodes, true);
          return filter;
        })
      }
      statusesToFilter={_.without(models.Node.prototype.statuses, 'discover')}
    />;
  }
});

export default ClusterNodesScreen;
