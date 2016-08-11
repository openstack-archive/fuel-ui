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
import moment from 'moment';
import {Table, Tooltip, Popover, MultiSelectControl, DownloadFileButton} from 'views/controls';
import {DeploymentTaskDetailsDialog} from 'views/dialogs';
import {
  DEPLOYMENT_HISTORY_VIEW_MODES, DEPLOYMENT_TASK_STATUSES, DEPLOYMENT_TASK_ATTRIBUTES
} from 'consts';

var ns = 'cluster_page.deployment_history.';

var parseTime = _.memoize((time) => Number(moment.utc(time)));

var DeploymentHistory = React.createClass({
  getDefaultProps() {
    return {
      timelineIntervalWidth: 75,
      timelineRowHeight: 28,
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
      millisecondsPerPixel: this.getTimelineMaxMillisecondsPerPixel()
    };
  },
  getCurrentTime() {
    return Number(moment.utc(
      this.props.deploymentHistory.lastFetchDate,
      'ddd, D MMM YYYY H:mm:ss [GMT]' // RFC 2822 date format used in HTTP headers
    )) + 1000; // we don't get milliseconds from server, so add 1 second so that tasks end time
               // won't be greater than current time
  },
  // FIXME(jaranovich): timeline start and end times should be provided from transaction
  // time_start and time_end attributes (#1593753 bug)
  getTimelineTimeInterval() {
    var {deploymentHistory, timelineIntervalWidth, timelineWidth} = this.props;
    var timeStart = deploymentHistory.reduce((result, task) => {
      return task.get('time_start') ? _.min([result, parseTime(task.get('time_start'))]) : result;
    }, this.getCurrentTime());
    var timeEnd = deploymentHistory.reduce((result, task) => {
      return task.get('time_end') ?
        _.max([result, parseTime(task.get('time_end'))]) :
        task.get('time_start') ?
        _.max([result, parseTime(task.get('time_start'))]) :
        result;
    },
      // set minimal timeline scale in case of transaction has 'pending' status
      timeStart + timelineWidth / timelineIntervalWidth * 1000
    );
    return [timeStart, timeEnd];
  },
  getTimelineMaxMillisecondsPerPixel(timelineTimeStart, timelineTimeEnd) {
    var {timelineIntervalWidth, timelineWidth} = this.props;
    return _.max([
      (timelineTimeEnd - timelineTimeStart) / timelineWidth,
      1000 / timelineIntervalWidth
    ]);
  },
  zoomInTimeline() {
    this.setState({millisecondsPerPixel: this.state.millisecondsPerPixel / 2});
  },
  zoomOutTimeline() {
    this.setState({millisecondsPerPixel: this.state.millisecondsPerPixel * 2});
  },
  changeViewMode(viewMode) {
    if (viewMode === this.state.viewMode) return;
    this.setState({
      viewMode,
      //close filters panel
      areFiltersVisible: false,
      openFilter: null
    });
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
    var {viewMode, areFiltersVisible, openFilter, filters, millisecondsPerPixel} = this.state;
    var {deploymentHistory, transaction, timelineIntervalWidth} = this.props;
    var areFiltersApplied = _.some(filters, ({values}) => values.length);
    var [timelineTimeStart, timelineTimeEnd] = this.getTimelineTimeInterval();

    // interval should be equal at least 1 second
    var canTimelineBeZoommedIn = millisecondsPerPixel / 2 >= 1000 / timelineIntervalWidth;
    var canTimelineBeZoommedOut =
      millisecondsPerPixel * 2 <=
      this.getTimelineMaxMillisecondsPerPixel(timelineTimeStart, timelineTimeEnd);

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
              <div>
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
                <DownloadFileButton
                  label={i18n(ns + 'export_csv')}
                  fileName={'deployment#' + transaction.id + '.csv'}
                  url={deploymentHistory.url}
                  headers={{Accept: 'text/csv'}}
                  className='btn btn-default pull-right btn-export-history-csv'
                  showProgressBar='inline'
                />
              </div>
            }
          </div>
          {viewMode === 'table' && areFiltersVisible && (
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
                    className={utils.classNames('filter-control', 'filter-by-' + filter.name)}
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
        {viewMode === 'table' && !areFiltersVisible && areFiltersApplied &&
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
              {... _.pick(this.props,
                'deploymentHistory', 'timelineWidth', 'timelineIntervalWidth', 'timelineRowHeight'
              )}
              {... _.pick(this.state, 'millisecondsPerPixel')}
              timeStart={timelineTimeStart}
              timeEnd={timelineTimeEnd}
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

var DeploymentHistoryTask = React.createClass({
  getInitialState() {
    return {isPopoverVisible: false};
  },
  togglePopover(isPopoverVisible) {
    this.setState({isPopoverVisible});
  },
  getColorFromString(str) {
    var color = (utils.getStringHashCode(str) & 0x00FFFFFF).toString(16).toUpperCase();
    return '#' + ('00000' + color).substr(-6);
  },
  render() {
    var {task, top, left, width} = this.props;

    var taskName = task.get('task_name');
    return <div
      onMouseEnter={() => this.togglePopover(true)}
      onMouseLeave={() => this.togglePopover(false)}
      className='node-task'
      style={{background: this.getColorFromString(taskName), top, left, width}}
    >
      {task.get('status') === 'error' &&
        <div className='error-marker' style={{left: Math.floor(width / 2)}} />
      }
      {this.state.isPopoverVisible &&
        <Popover
          placement='top'
          container='body'
          className='deployment-task-info'
        >
          <div>
            {DEPLOYMENT_TASK_ATTRIBUTES
              .map((attr) => <p key={attr} className={attr}>
                <span>
                  {i18n('dialog.deployment_task_details.task.' + attr) + ': '}
                </span>
                <span>
                  {_.startsWith(attr, 'time') ?
                    utils.formatTimestamp(task.get(attr)) : task.get(attr)
                  }
                </span>
              </p>)
            }
          </div>
        </Popover>
      }
    </div>;
  }
});

var DeploymentHistoryTimeline = React.createClass({
  getIntervalLabel(index) {
    var {timelineIntervalWidth, millisecondsPerPixel} = this.props;
    var seconds = Math.floor(millisecondsPerPixel / 1000 * timelineIntervalWidth * (index + 1));
    var minutes = seconds < 60 ? 0 : Math.floor(seconds / 60);
    seconds = seconds - (minutes * 60);
    var hours = minutes < 60 ? 0 : Math.floor(minutes / 60);
    minutes = minutes - (hours * 60);
    if (hours) return i18n(ns + 'hours', {hours, minutes});
    if (minutes) {
      return i18n(ns + (seconds ? 'minutes_and_seconds' : 'minutes'), {minutes, seconds});
    }
    return i18n(ns + 'seconds', {seconds});
  },
  getTimeIntervalWidth(timeStart, timeEnd) {
    return Math.floor((timeEnd - timeStart) / this.props.millisecondsPerPixel);
  },
  adjustOffsets(e) {
    this.refs.scale.style.left = -e.target.scrollLeft + 'px';
    this.refs.names.style.top = -e.target.scrollTop + 'px';
  },
  render() {
    var {
      deploymentHistory, timeStart, timeEnd, isRunning,
      timelineWidth, timelineIntervalWidth, timelineRowHeight, millisecondsPerPixel
    } = this.props;
    var nodeIds = [];
    var nodeOffsets = {};
    deploymentHistory.each((task) => {
      var nodeId = task.get('node_id');
      if (_.has(nodeOffsets, nodeId)) return;
      nodeOffsets[nodeId] = nodeIds.length;
      nodeIds.push(nodeId);
    });
    var intervals = Math.ceil(_.max([
      (timeEnd - timeStart) / (millisecondsPerPixel * timelineIntervalWidth),
      timelineWidth / timelineIntervalWidth
    ]));

    return (
      <div className='col-xs-12'>
        <div className='deployment-timeline clearfix'>
          <div className='node-names-column'>
            <div className='header' />
            <div className='node-names-container'>
              <div className='node-names' ref='names'>
                {_.map(nodeIds,
                  (nodeId) => <div key={nodeId}>{nodeId === 'master' ? nodeId : '#' + nodeId}</div>
                )}
              </div>
            </div>
          </div>
          <div className='timelines-column'>
            <div className='header'>
              <div className='scale' ref='scale' style={{width: intervals * timelineIntervalWidth}}>
                {_.times(intervals, (n) => <div key={n}>{this.getIntervalLabel(n)}</div>)}
              </div>
            </div>
            <div className='timelines-container' onScroll={this.adjustOffsets}>
              <div
                className='timelines'
                style={{
                  width: intervals * timelineIntervalWidth,
                  height: nodeIds.length * timelineRowHeight
                }}
              >
                {deploymentHistory.map((task) => {
                  if (!_.includes(['ready', 'error', 'running'], task.get('status'))) return null;

                  var taskTimeStart = task.get('time_start') ?
                    parseTime(task.get('time_start')) : 0;
                  var taskTimeEnd = task.get('time_end') ?
                    parseTime(task.get('time_end')) : timeEnd;

                  var width = this.getTimeIntervalWidth(taskTimeStart, taskTimeEnd);
                  if (!width) return null;

                  var top = timelineRowHeight * nodeOffsets[task.get('node_id')];
                  var left = this.getTimeIntervalWidth(timeStart, taskTimeStart);

                  return <DeploymentHistoryTask
                    key={task.get('node_id') + ' ' + task.get('task_name')}
                    task={task}
                    top={top}
                    left={left}
                    width={width}
                  />;
                })}
                {isRunning &&
                  <div
                    key='current-time-marker'
                    className='current-time-marker'
                    style={{
                      height: nodeIds.length * timelineRowHeight,
                      left: this.getTimeIntervalWidth(timeStart, timeEnd)
                    }}
                  />
                }
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
