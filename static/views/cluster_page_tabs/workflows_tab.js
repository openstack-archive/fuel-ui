/*
 * Copyright 2016 Mirantis, Inc.
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
import i18n from 'i18n';
import React from 'react';
import {DEPLOYMENT_GRAPH_LEVELS} from 'consts';
import utils from 'utils';
import {Tooltip, MultiSelectControl, DownloadFileButton} from 'views/controls';
import models from 'models';
import {backboneMixin} from 'component_mixins';
import {UploadGraphDialog, DeleteGraphDialog} from 'views/dialogs';

var ns = 'cluster_page.workflows_tab.';

var WorkflowsTab = React.createClass({
  mixins: [
    backboneMixin({
      modelOrCollection: (props) => props.cluster.get('deploymentGraphs'),
      renderOn: 'update'
    })
  ],
  statics: {
    breadcrumbsPath() {
      return [
        [i18n('cluster_page.tabs.workflows'), null, {active: true}]
      ];
    },
    fetchData({cluster}) {
      var deploymentGraphs = cluster.get('deploymentGraphs');
      var plugins = new models.Plugins();
      return deploymentGraphs.fetch({cache: true})
        .then(() => {
          if (deploymentGraphs.some((graph) => graph.getLevel() === 'plugin')) {
            return plugins.fetch();
          }
          return Promise.resolve();
        })
        .then(() => ({plugins}));
    }
  },
  getInitialState() {
    return {
      filters: [
        {
          name: 'graph_type',
          label: i18n(ns + 'filter_by_graph_type'),
          values: [],
          options: () => _.uniq(this.props.cluster.get('deploymentGraphs').invokeMap('getType')),
          addOptionsFilter: true
        }, {
          name: 'graph_level',
          label: i18n(ns + 'filter_by_graph_level'),
          values: [],
          options: () => DEPLOYMENT_GRAPH_LEVELS
        }
      ],
      areFiltersVisible: false,
      openFilter: null
    };
  },
  toggleFilters() {
    this.setState({
      areFiltersVisible: !this.state.areFiltersVisible,
      openFilter: null
    });
  },
  toggleFilter(name, visible) {
    var {openFilter} = this.state;
    var isFilterOpen = openFilter === name;
    visible = _.isBoolean(visible) ? visible : !isFilterOpen;
    this.setState({
      openFilter: visible ? name : isFilterOpen ? null : openFilter
    });
  },
  changeFilter(name, values) {
    var {filters} = this.state;
    _.find(filters, {name}).values = values;
    this.setState({filters});
  },
  resetFilters() {
    var {filters} = this.state;
    _.each(filters, (filter) => {
      filter.values = [];
    });
    this.setState({filters});
  },
  normalizeAppliedFilters() {
    var deploymentGraphs = this.props.cluster.get('deploymentGraphs');
    var filterValueChecks = {
      graph_type: (type) => deploymentGraphs.some((graph) => graph.getType() === type)
    };
    _.each(this.state.filters, ({name, values}) => {
      if (values.length && filterValueChecks[name]) {
        var normalizedValues = _.filter(values, filterValueChecks[name]);
        if (!_.isEqual(values, normalizedValues)) this.changeFilter(name, normalizedValues);
      }
    });
  },
  deleteGraph(graph) {
    DeleteGraphDialog.show({graph})
      .then(this.normalizeAppliedFilters);
  },
  uploadGraph() {
    var {cluster} = this.props;
    UploadGraphDialog.show({cluster})
      .then(() => cluster.get('deploymentGraphs').fetch());
  },
  render() {
    var {areFiltersVisible, openFilter, filters} = this.state;
    var {cluster, plugins} = this.props;

    var areFiltersApplied = _.some(filters, ({values}) => values.length);
    var chosenGraphLevels = _.find(filters, {name: 'graph_level'}).values;
    var chosenGraphTypes = _.find(filters, {name: 'graph_type'}).values;
    var graphs = cluster.get('deploymentGraphs').filter(
      (graph) => (!chosenGraphTypes.length || _.includes(chosenGraphTypes, graph.getType())) &&
          (!chosenGraphLevels.length || _.includes(chosenGraphLevels, graph.getLevel()))
    );
    var graphTypes = _.uniq(_.invokeMap(graphs, 'getType'));

    return (
      <div className='deployment-graphs'>
        <div className='row'>
          <div className='title col-xs-12'>
            {i18n(ns + 'title')}
          </div>
          <div className='wrapper col-xs-12'>
            <div className='deployment-graphs-toolbar'>
              <div className='buttons'>
                <Tooltip wrap text={i18n(ns + 'filter_tooltip')}>
                  <button
                    onClick={this.toggleFilters}
                    className={utils.classNames({
                      'btn btn-default pull-left btn-filters': true,
                      active: areFiltersVisible
                    })}
                  >
                    <i className='glyphicon glyphicon-filter' />
                  </button>
                </Tooltip>
                <div className='btn-group pull-right' data-toggle='buttons'>
                  <button
                    className='btn btn-success btn-upload-graph'
                    onClick={this.uploadGraph}
                  >
                    <i className='glyphicon glyphicon-plus-white' />
                    {i18n(ns + 'upload_graph')}
                  </button>
                </div>
              </div>
              {areFiltersVisible && (
                <div className='filters'>
                  <div className='well clearfix'>
                    <div className='well-heading'>
                      <i className='glyphicon glyphicon-filter' /> {i18n(ns + 'filter_by')}
                      {areFiltersApplied &&
                        <button
                          className='btn btn-link pull-right btn-reset-filters'
                          onClick={this.resetFilters}
                        >
                          <i className='glyphicon discard-changes-icon' />
                          &nbsp; {i18n('common.reset_button')}
                        </button>
                      }
                    </div>
                    {_.map(filters,
                      (filter) => <MultiSelectControl
                        {...filter}
                        key={filter.name}
                        className={utils.classNames('filter-control', 'filter-by-' + filter.name)}
                        onChange={_.partial(this.changeFilter, filter.name)}
                        isOpen={openFilter === filter.name}
                        toggle={_.partial(this.toggleFilter, filter.name)}
                        options={
                          _.map(filter.options(), (value) => ({name: value, title: value}))
                        }
                      />
                    )}
                  </div>
                </div>
              )}
              {!areFiltersVisible && areFiltersApplied &&
                <div className='active-sorters-filters'>
                  <div className='active-filters row' onClick={this.toggleFilters}>
                    <strong className='col-xs-1'>{i18n(ns + 'filter_by')}</strong>
                    <div className='col-xs-11'>
                      {_.map(filters, ({name, label, values}) => {
                        if (!values.length) return null;
                        return <div key={name}>
                          <strong>{label + ':'}</strong> <span>{values.join(', ')}</span>
                        </div>;
                      })}
                    </div>
                    <button
                      className='btn btn-link btn-reset-filters'
                      onClick={this.resetFilters}
                    >
                      <i className='glyphicon discard-changes-icon' />
                    </button>
                  </div>
                </div>
              }
            </div>
          </div>
          <div className='col-xs-12'>
            {graphs.length ?
              <table className='table table-hover workflows-table'>
                <thead>
                  <tr>
                    <th>{i18n(ns + 'graph_name_header')}</th>
                    <th>{i18n(ns + 'graph_level_header')}</th>
                    <th />
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {_.map(graphTypes,
                    (graphType) => [
                      <tr key='subheader' className='subheader'>
                        <td colSpan='3'>
                          {i18n(ns + 'graph_type', {graphType})}
                        </td>
                        <td>
                          <DownloadFileButton
                            label={i18n(ns + 'download_graph')}
                            fileName={graphType + '.json'}
                            url={'/api/clusters/' + cluster.id + '/deployment_tasks/'}
                            fetchOptions={{graph_type: graphType}}
                            className='btn btn-link btn-download-merged-graph'
                            showProgressBar='global'
                          />
                        </td>
                      </tr>
                    ].concat(
                      _.map(graphs, (graph) => {
                        if (graph.getType() !== graphType) return null;

                        var level = graph.getLevel();
                        return <tr key={graph.id}>
                          <td>{graph.get('name') || '-'}</td>
                          <td className='level'>
                            {level}
                            &nbsp;
                            {level === 'plugin' &&
                              <span>
                                ({plugins.get(graph.get('relations')[0].model_id).get('title')})
                              </span>
                            }
                          </td>
                          <td>
                            {level === 'cluster' &&
                              <button
                                className='btn btn-link  btn-remove-graph'
                                onClick={() => this.deleteGraph(graph)}
                              >
                                {i18n(ns + 'delete_graph')}
                              </button>
                            }
                          </td>
                          <td>
                            <DownloadFileButton
                              label={i18n(ns + 'download_graph')}
                              fileName={graphType + '-' + level + '.json'}
                              fileContent={() => JSON.stringify(graph.get('tasks'), null, 2)}
                              className='btn btn-link btn-download-graph'
                            />
                          </td>
                        </tr>;
                      })
                    )
                  )}
                </tbody>
              </table>
            :
              <div className='alert alert-warning'>{i18n(ns + 'no_graphs_matched_filters')}</div>
            }
          </div>
        </div>
      </div>
    );
  }
});

export default WorkflowsTab;
