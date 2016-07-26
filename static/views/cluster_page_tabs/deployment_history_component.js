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
import {
  DEPLOYMENT_HISTORY_VIEW_MODES, DEPLOYMENT_TASK_STATUSES, DEPLOYMENT_TASK_ATTRIBUTES
} from 'consts';

var ns = 'cluster_page.deployment_history.';

var DeploymentHistory = React.createClass({
  getDefaultProps() {
    return {
      timelineIntervalWidth: 75,
      timelineWidth: 893
    };
  },
  getInitialState() {
    var {deploymentHistory} = this.props;
    return {
      viewMode: 'timeline',
      areFiltersVisible: false,
      openFilter: null,
      filters: [
        {
          name: 'task_name',
          label: i18n(ns + 'filter_by_task_name'),
          values: [],
          options: _.uniq(deploymentHistory.map('task_name')).sort(),
          addOptionsFilter: true
        }, {
          name: 'node_id',
          label: i18n(ns + 'filter_by_node_id'),
          values: [],
          options: _.uniq(deploymentHistory.map('node_id')),
          addOptionsFilter: true
        }, {
          name: 'status',
          label: i18n(ns + 'filter_by_status'),
          values: [],
          options: DEPLOYMENT_TASK_STATUSES
        }
      ],
      secondsPerPixel: this.getTimelineMaxSecondsPerPixel()
    };
  },
  // FIXME(jaranovich): timeline start and end times should be provided from transaction
  // time_start and time_end attributes (#1593753 bug)
  getTimelineTimeStart() {
    var {deploymentHistory} = this.props;
    return _.min(_.compact(deploymentHistory.map(
      (task) => utils.dateToSeconds(task.get('time_start'))
    ))) ||
    // make current time a default time in case of transaction has 'pending' status
    _.now() / 1000;
  },
  getTimelineTimeEnd() {
    var {transaction, deploymentHistory} = this.props;
    if (transaction.match({status: 'running'})) return _.now() / 1000;
    return _.max(_.compact(deploymentHistory.map(
      (task) => utils.dateToSeconds(task.get('time_end'))
    ))) ||
    // make 60min default timeline in case of transaction has 'pending' status
    _.now() / 1000 + 60 * 60;
  },
  getTimelineMaxSecondsPerPixel() {
    return parseFloat(
      (this.getTimelineTimeEnd() - this.getTimelineTimeStart()) / this.props.timelineWidth
    ).toFixed(2);
  },
  zoomInTimeline() {
    this.setState({secondsPerPixel: this.state.secondsPerPixel / 2});
  },
  zoomOutTimeline() {
    this.setState({secondsPerPixel: this.state.secondsPerPixel * 2});
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
    var {viewMode, areFiltersVisible, openFilter, filters, secondsPerPixel} = this.state;
    var {deploymentHistory, transaction, timelineIntervalWidth} = this.props;

    var areFiltersApplied = _.some(filters, ({values}) => values.length);

    // interval should be equal at least 1 second
    var canTimelineBeZoommedIn = secondsPerPixel / 2 >= 1 / timelineIntervalWidth;
    var canTimelineBeZoommedOut = secondsPerPixel * 2 <= this.getTimelineMaxSecondsPerPixel();

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
            {viewMode === 'timeline' &&
              <div className='zoom-controls pull-right'>
                <div className='btn-group' data-toggle='buttons'>
                  <Tooltip text={i18n(ns + 'zoom_in_tooltip')}>
                    <button
                      className='btn btn-default btn-zoom-in pull-left'
                      onClick={this.zoomInTimeline}
                      disabled={!canTimelineBeZoommedIn}
                    >
                      <i className='glyphicon glyphicon-plus-dark' />
                    </button>
                  </Tooltip>
                  <Tooltip text={i18n(ns + 'zoom_out_tooltip')}>
                    <button
                      className='btn btn-default btn-zoom-out pull-left'
                      onClick={this.zoomOutTimeline}
                      disabled={!canTimelineBeZoommedOut}
                    >
                      <i className='glyphicon glyphicon-minus-dark' />
                    </button>
                  </Tooltip>
                </div>
              </div>
            }
            {viewMode === 'table' &&
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
                    className={utils.classNames('filter-control', ['filter-by-' + filter.name])}
                    onChange={_.partial(this.changeFilter, filter.name)}
                    isOpen={openFilter === filter.name}
                    toggle={_.partial(this.toggleFilter, filter.name)}
                    options={_.map(filter.options, (value) => ({name: value, title: value}))}
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
          {viewMode === 'timeline' &&
            <DeploymentHistoryTimeline
              {... _.pick(this.props, 'deploymentHistory', 'timelineIntervalWidth')}
              {... _.pick(this.state, 'secondsPerPixel')}
              timeStart={this.getTimelineTimeStart()}
              timeEnd={this.getTimelineTimeEnd()}
              isRunning={transaction.match({status: 'running'})}
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
  getIntervalLabel(index) {
    var {timelineIntervalWidth, secondsPerPixel} = this.props;
    var seconds = Math.floor(secondsPerPixel * timelineIntervalWidth * (index + 1));
    var minutes = seconds < 60 ? 0 : Math.floor(seconds / 60);
    seconds = seconds - (minutes * 60);
    var hours = minutes < 60 ? 0 : Math.floor(minutes / 60);
    minutes = minutes - (hours * 60);
    if (hours) return i18n(ns + 'hours', {hours, minutes});
    if (minutes) {
      return i18n(
        ns + (minutes > 5 ? 'minutes' : 'minutes_and_seconds'),
        {minutes, seconds}
      );
    }
    return i18n(ns + 'seconds', {seconds});
  },
  getTaskWidth(timeStart, timeEnd) {
    return Math.floor((timeEnd - timeStart) / this.props.secondsPerPixel);
  },
  getColorFromString(str) {
    var color = (utils.getStringHashCode(str) & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + ('00000' + color).substr(-6);
  },
  render() {
    var {
      deploymentHistory, timeStart, timeEnd, isRunning, timelineIntervalWidth, secondsPerPixel
    } = this.props;
    var nodeIds = _.uniq(deploymentHistory.map('node_id'));
    var intervals = Math.ceil((timeEnd - timeStart) / (secondsPerPixel * timelineIntervalWidth));

    return (
      <div className='col-xs-12'>
        <div className='deployment-timeline clearfix'>
          <div className='node-names'>
            <div className='header' />
            <div className='delimiter' />
            {_.map(nodeIds,
              (nodeId) => <div key={nodeId}>{nodeId === 'master' ? nodeId : '#' + nodeId}</div>
            )}
          </div>
          <div className='node-timelines'>
            <div className='node-timelines-inner'>
              {isRunning &&
                <div
                  className='current-time-marker'
                  style={{left: this.getTaskWidth(timeStart, timeEnd)}}
                />
              }
              <div className='header clearfix' style={{width: intervals * timelineIntervalWidth}}>
                {_.times(intervals, (n) => <div key={n}>{this.getIntervalLabel(n)}</div>)}
              </div>
              <div className='delimiter' />
              <div className='timelines' style={{width: intervals * timelineIntervalWidth}}>
                {_.map(nodeIds, (nodeId) =>
                  <div key={nodeId} className='clearfix'>
                    {deploymentHistory.map((task) => {
                      if (
                        task.get('node_id') !== nodeId ||
                        !_.includes(['ready', 'error', 'running'], task.get('status'))
                      ) return null;

                      var taskName = task.get('task_name');
                      var left = this.getTaskWidth(
                        timeStart,
                        utils.dateToSeconds(task.get('time_start'))
                      );
                      var width = this.getTaskWidth(
                        utils.dateToSeconds(task.get('time_start')),
                        task.get('time_end') ? utils.dateToSeconds(task.get('time_end')) : timeEnd
                      );
                      return <Tooltip key={taskName} text={taskName}>
                        <div
                          className='node-task'
                          style={{background: this.getColorFromString(taskName), left, width}}
                        >
                          {task.get('status') === 'error' &&
                            <div className='error-marker' style={{left: Math.floor(width / 2)}} />
                          }
                        </div>
                      </Tooltip>;
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
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
