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
import utils from 'utils';
import {Table, Tooltip, MultiSelectControl} from 'views/controls';
import {DeploymentTaskDetailsDialog} from 'views/dialogs';
import {DEPLOYMENT_TASK_STATUSES, DEPLOYMENT_TASK_ATTRIBUTES} from 'consts';

var ns = 'cluster_page.deployment_history.';

var DeploymentHistory = React.createClass({
  getInitialState() {
    return {
      areFiltersVisible: false,
      openFilter: null,
      filters: [
        {
          name: 'task_name',
          label: i18n(ns + 'filter_by_task_name'),
          values: [],
          options: (deploymentHistory) => _.uniq(deploymentHistory.map('task_name')).sort(),
          addOptionsFilter: true
        }, {
          name: 'node_id',
          label: i18n(ns + 'filter_by_node_id'),
          values: [],
          options: (deploymentHistory) => _.uniq(deploymentHistory.map('node_id')),
          addOptionsFilter: true
        }, {
          name: 'status',
          label: i18n(ns + 'filter_by_status'),
          values: [],
          options: () => DEPLOYMENT_TASK_STATUSES
        }
      ]
    };
  },
  toggleFilters() {
    this.setState({
      areFiltersVisible: !this.state.areFiltersVisible,
      openFilter: null
    });
  },
  toggleFilter(filterName, visible) {
    var {openFilter} = this.state;
    var isFilterOpen = openFilter === filterName;
    visible = _.isBoolean(visible) ? visible : !isFilterOpen;
    this.setState({
      openFilter: visible ? filterName : isFilterOpen ? null : openFilter
    });
  },
  changeFilter(filterName, values) {
    var {filters} = this.state;
    _.find(filters, {name: filterName}).values = values;
    this.setState({filters});
  },
  resetFilters() {
    var {filters} = this.state;
    _.each(filters, (filter) => {
      filter.values = [];
    });
    this.setState({filters});
  },
  render() {
    var {areFiltersVisible, openFilter, filters} = this.state;
    var {deploymentHistory} = this.props;

    var areFiltersApplied = _.some(filters, ({values}) => values.length);
    var deploymentTasks = deploymentHistory.filter(
      (task) => _.every(filters,
        ({name, values}) => !values.length || _.includes(values, task.get(name))
      )
    );

    return (
      <div className='deployment-history-table'>
        <div className='deployment-history-toolbar row'>
          <div className='col-xs-12 buttons'>
            <Tooltip wrap key='filters-btn' text={i18n(ns + 'filter_tooltip')}>
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
          </div>
          {areFiltersVisible && (
            <div className='filters col-xs-12'>
              <div className='well clearfix'>
                <div className='well-heading'>
                  <i className='glyphicon glyphicon-filter' /> {i18n(ns + 'filter_by')}
                  {areFiltersApplied &&
                    <button
                      className='btn btn-link pull-right btn-reset-filters'
                      onClick={this.resetFilters}
                    >
                      <i className='glyphicon discard-changes-icon' /> {i18n('common.reset_button')}
                    </button>
                  }
                </div>
                {_.map(filters,
                  (filter) => <MultiSelectControl
                    {...filter}
                    key={filter.name}
                    className={utils.classNames({
                      'filter-control': true,
                      ['filter-by-' + filter.name]: true
                    })}
                    onChange={_.partial(this.changeFilter, filter.name)}
                    isOpen={openFilter === filter.name}
                    toggle={_.partial(this.toggleFilter, filter.name)}
                    options={_.map(filter.options(deploymentHistory),
                      (value) => ({name: value, title: value})
                    )}
                  />
                )}
              </div>
            </div>
          )}
        </div>
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
        <div className='row'>
          <div className='history-table col-xs-12'>
            {deploymentTasks.length ?
              <Table
                head={
                  DEPLOYMENT_TASK_ATTRIBUTES
                    .map((attr) => ({label: i18n(ns + attr + '_header')}))
                    .concat([{label: ''}])
                }
                body={_.map(deploymentTasks,
                  (task) => DEPLOYMENT_TASK_ATTRIBUTES
                    .map((attr) => _.startsWith(attr, 'time') ?
                      utils.formatTimestamp(task.get(attr)) : task.get(attr)
                    )
                    .concat([
                      <button
                        key={task.get('task_name') + 'details'}
                        className='btn btn-link'
                        onClick={() => DeploymentTaskDetailsDialog.show({task})}
                      >
                        {i18n(ns + 'task_details')}
                      </button>
                    ])
                )}
              />
            :
              <div className='alert alert-warning'>{i18n(ns + 'no_tasks_matched_filters')}</div>
            }
          </div>
        </div>
      </div>
    );
  }
});

export default DeploymentHistory;
