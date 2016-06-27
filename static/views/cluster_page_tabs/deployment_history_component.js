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
import {Table, Tooltip, Popover, MultiSelectControl} from 'views/controls';
import {DeploymentTaskDetailsDialog} from 'views/dialogs';
import {
  DEPLOYMENT_HISTORY_VIEW_MODES, DEPLOYMENT_TASK_STATUSES, DEPLOYMENT_TASK_ATTRIBUTES
} from 'consts';

var ns = 'cluster_page.deployment_history.';

var DeploymentHistory = React.createClass({
  getInitialState() {
    return {
      viewMode: 'timeline',
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
  changeViewMode(viewMode) {
    if (viewMode === this.state.viewMode) return;
    this.setState({viewMode});
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
    var {viewMode, areFiltersVisible, openFilter, filters} = this.state;
    var {deploymentHistory} = this.props;

    var areFiltersApplied = _.some(filters, ({values}) => values.length);

    return (
      <div className='deployment-history-table'>
        <div className='deployment-history-toolbar row'>
          <div className='col-xs-12 buttons'>
            <div className='view-modes pull-left'>
              <div className='btn-group' data-toggle='buttons'>
                {_.map(DEPLOYMENT_HISTORY_VIEW_MODES, (mode) => {
                  return (
                    <Tooltip key={mode + '-view'} text={i18n(ns + mode + '_mode_tooltip')}>
                      <label
                        className={utils.classNames({
                          'btn btn-default pull-left': true,
                          [mode + '-view']: true,
                          active: mode === viewMode
                        })}
                        onClick={() => this.changeViewMode(mode)}
                      >
                        <input type='radio' name='view_mode' value={mode} />
                        <i className={utils.classNames('glyphicon', 'glyphicon-' + mode)} />
                      </label>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
            {viewMode === 'table' &&
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
            }
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
                  if (!values.length) return;
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
          {viewMode === 'timeline' &&
            <DeploymentHistoryTimeline
              {... _.pick(this.props, 'deploymentHistory', 'isRunning')}
            />
          }
          {viewMode === 'table' &&
            <DeploymentHistoryTable
              deploymentTasks={deploymentHistory.filter((task) =>
                _.every(filters, ({name, values}) =>
                  !values.length || _.includes(values, task.get(name))
                )
              )}
            />
          }
        </div>
      </div>
    );
  }
});

var DeploymentHistoryTimeline = React.createClass({
  getInitialState() {
    return {
      secPerPx: 4,
      secPerInterval: 5 * 60
    };
  },
  changeScale(secPerPx) {
    this.setState({secPerPx});
  },
  onWheel(e) {
    var {secPerPx, secPerInterval} = this.state;
    if (e.nativeEvent.deltaY < 0) {
      this.setState({ // scrolling up
        secPerPx: secPerPx / 2, secPerInterval: secPerInterval / 2
      });
    } else {
      this.setState({ // scrolling down
        secPerPx: secPerPx * 2, secPerInterval: secPerInterval * 2
      });
    }
  },
  render() {
    var {deploymentHistory, isRunning} = this.props;
    if (_.isNull(deploymentHistory)) return null;
    var {secPerPx, secPerInterval} = this.state;

    var nodeIds = _.uniq(deploymentHistory.map('node_id'));

    var getTime = (date) => (Date.parse(new Date(date).toUTCString()) / 1000);
    var timeStart = _.min(
      _.compact(deploymentHistory.map((task) => getTime(task.get('time_start'))))
    );
    var timeEnd = isRunning ? _.now() : _.max(
      deploymentHistory.map((task) => getTime(task.get('time_end')))
    );

    var getPx = (start, end) => Math.floor((end - start) / secPerPx);
    var intervals = Math.ceil((timeEnd - timeStart) / secPerInterval) + 1;
    var totalWidth = (intervals * secPerInterval / secPerPx) + 250;
    var coef = Math.floor((totalWidth - 250 - (intervals * secPerInterval / secPerPx)) / intervals);
    coef = 1;

    return (
      <div className='deployment-timeline' onWheel={this.onWheel}>
        <div className='timeline-header clearfix' style={{width: totalWidth}}>
          <div className='node-name' />
          <div className='timeline clearfix'>
            {_.times(intervals, (n) => {
              var seconds = secPerInterval * (n + 1);
              var minutes = seconds < 60 ? 0 : Math.floor(seconds / 60);
              seconds = seconds - (minutes * 60);
              var hours = minutes < 60 ? 0 : Math.floor(minutes / 60);
              minutes = minutes - (hours * 60);
              var width = secPerInterval / secPerPx * coef;
              return <div key={n} style={{width}}>
                {width > 20 && (
                  hours ?
                    i18n(ns + 'hours', {hours, minutes})
                  :
                    minutes ? i18n(ns + 'minutes', {minutes}) : i18n(ns + 'seconds', {seconds})
                )}
              </div>;
            })}
          </div>
        </div>
        <div className='timeline-body'>
          {isRunning &&
            <div
              className='current-time-marker'
              style={{left: getPx(timeStart, timeEnd) + 250}}
            />
          }
          <div className='delimiter'><div className='node-name' /></div>
          {_.map(nodeIds, (nodeId) => {
            var timelineProps = {
              nodeId, timeStart, timeEnd, totalWidth, coef, getPx, getTime,
              key: nodeId,
              tasks: deploymentHistory.filter(
                (task) => task.get('node_id') === nodeId &&
                  _.includes(['ready', 'error', 'running'], task.get('status'))
              ),
              backgrounds: _.times(70, () => '#' + Math.random().toString(16).slice(2, 8))
            };
            return <NodeTimeline {...timelineProps} />;
          })}
          <div className='delimiter'><div className='node-name' /></div>
        </div>
      </div>
    );
  }
});

var NodeTimeline = React.createClass({
  getInitialState() {
    return {openPopover: null};
  },
  togglePopover(openPopover) {
    this.setState({openPopover});
  },
  render() {
    var {
      nodeId, tasks, timeStart, timeEnd, getPx, getTime, backgrounds, totalWidth, coef
    } = this.props;
    return (
      <div className='node-timeline' style={{width: totalWidth}}>
        <div className='node-name'>
          {nodeId === 'master' ? nodeId : '#' + nodeId}
        </div>
        <div className='timeline'>
          {tasks.map((task, index) => {
            var taskName = task.get('task_name');
            var isError = task.get('status') === 'error';
            var left = getPx(timeStart, getTime(task.get('time_start')));
            var width = getPx(
              getTime(task.get('time_start')),
              task.get('time_end') ? getTime(task.get('time_end')) : timeEnd
            ) * coef;
            return <div
              key={taskName}
              className='node-task'
              onMouseEnter={() => this.togglePopover(taskName)}
              onMouseLeave={() => this.togglePopover(null)}
              style={{background: backgrounds[index], left, width}}
            >
              {isError &&
                <div
                  className='error-marker'
                  style={{left: Math.floor((width - 6) / 2)}}
                />
              }
              <div className='popover-container'>
                {this.state.openPopover === taskName &&
                  <Popover placement='right' className='task-popover'>
                    <div className={utils.classNames('task-data', task.get('status'))}>
                      {DEPLOYMENT_TASK_ATTRIBUTES
                        .map((attr) => <p key={attr} className={attr}>
                          {i18n('dialog.deployment_task_details.task.' + attr) + ': '}
                          <span>
                            {_.startsWith(attr, 'time') ?
                              utils.formatTimestamp(task.get(attr)) : task.get(attr)
                            }
                          </span>
                        </p>)
                      }
                    </div>
                    {isError && !!task.get('message') &&
                      <div className='task-message'>
                        <i className='glyphicon glyphicon-danger-sign' /> {task.get('message')}
                      </div>
                    }
                  </Popover>
                }
              </div>
            </div>;
          })}
        </div>
      </div>
    );
  }
});

var DeploymentHistoryTable = React.createClass({
  render() {
    var {deploymentTasks} = this.props;
    return (
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
    );
  }
});

export default DeploymentHistory;
