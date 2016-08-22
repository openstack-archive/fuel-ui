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
import {Sorter} from 'views/cluster_page_tabs/nodes_tab_screens/sorter_and_filter';
import {DeploymentTaskDetailsDialog} from 'views/dialogs';
import {
  DEPLOYMENT_HISTORY_VIEW_MODES, DEPLOYMENT_TASK_STATUSES, DEPLOYMENT_TASK_ATTRIBUTES
} from 'consts';

var ns = 'cluster_page.deployment_history.';
var sorterNs = ns + 'sort_by_';

var parseISO8601Date = _.memoize((date) => new Date(date + 'Z').getTime());
var parseRFC2822Date = (date) => Number(moment.utc(date, 'ddd, D MMM YYYY H:mm:ss [GMT]', true));

var DeploymentHistory = React.createClass({
  propTypes: {
    width: React.PropTypes.number.isRequired
  },
  getDefaultProps() {
    return {
      timelineIntervalWidth: 75,
      timelineRowHeight: 28,
      defaultSorting: [{node_id: 'asc'}, {time_start: 'asc'}],
      availableSorters: DEPLOYMENT_TASK_ATTRIBUTES
    };
  },
  getInitialState() {
    var {deploymentHistory, defaultSorting, availableSorters} = this.props;
    return {
      viewMode: 'timeline',
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
      activeSorters: _.map(defaultSorting, _.partial(Sorter.fromObject, _, sorterNs, false)),
      availableSorters: _.map(availableSorters, (name) => new Sorter(name, 'asc', sorterNs)),
      millisecondsPerPixel:
        this.getTimelineMaxMillisecondsPerPixel(...this.getTimelineTimeInterval())
    };
  },
  getCurrentTime() {
    // we don't get milliseconds from server, so add 1 second so that tasks end time
    // won't be greater than current time
    return parseRFC2822Date(this.props.deploymentHistory.lastFetchDate) + 1000;
  },
  // FIXME(jaranovich): timeline start and end times should be provided from transaction
  // time_start and time_end attributes (#1593753 bug)
  getTimelineTimeInterval() {
    var {transaction, deploymentHistory} = this.props;
    var timelineTimeStart, timelineTimeEnd;
    timelineTimeStart = this.getCurrentTime();
    if (transaction.match({status: 'running'})) timelineTimeEnd = timelineTimeStart;
    deploymentHistory.each((task) => {
      var taskTimeStart = task.get('time_start');
      if (taskTimeStart) {
        taskTimeStart = parseISO8601Date(taskTimeStart);
        if (taskTimeStart < timelineTimeStart) timelineTimeStart = taskTimeStart;
        if (!timelineTimeEnd) timelineTimeEnd = timelineTimeStart;
        if (taskTimeStart > timelineTimeEnd) timelineTimeEnd = taskTimeStart;
        var taskTimeEnd = task.get('time_end');
        if (taskTimeEnd) {
          taskTimeEnd = parseISO8601Date(taskTimeEnd);
          if (taskTimeEnd > timelineTimeEnd) timelineTimeEnd = taskTimeEnd;
        }
      }
    });
    return [timelineTimeStart, timelineTimeEnd];
  },
  getTimelineMaxMillisecondsPerPixel(timelineTimeStart, timelineTimeEnd) {
    return _.max([
      (timelineTimeEnd - timelineTimeStart) / this.getNodeTimelineContainerWidth(),
      1000 / this.props.timelineIntervalWidth
    ]);
  },
  getNodeTimelineContainerWidth() {
    return Math.floor(this.props.width * 0.8);
  },
  zoomInTimeline() {
    this.setState({millisecondsPerPixel: this.state.millisecondsPerPixel / 2});
  },
  zoomOutTimeline() {
    this.setState({millisecondsPerPixel: this.state.millisecondsPerPixel * 2});
  },
  changeViewMode(viewMode) {
    if (viewMode !== this.state.viewMode) this.setState({viewMode});
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
  addSorting(sorter) {
    this.setState({activeSorters: this.state.activeSorters.concat(sorter)});
  },
  removeSorting(sorter) {
    this.setState({activeSorters: _.difference(this.state.activeSorters, [sorter])});
  },
  changeSortingOrder(sorterToChange) {
    this.setState({
      activeSorters: this.state.activeSorters.map((sorter) => {
        if (sorter.name === sorterToChange.name) {
          return new Sorter(sorter.name, sorter.order === 'asc' ? 'desc' : 'asc', sorterNs);
        }
        return sorter;
      })
    });
  },
  resetSorters() {
    this.setState({
      activeSorters: _.map(this.props.defaultSorting,
        _.partial(Sorter.fromObject, _, sorterNs, false)
      )
    });
  },
  render() {
    var {viewMode, filters, activeSorters, millisecondsPerPixel} = this.state;
    var {deploymentHistory, transaction, timelineIntervalWidth} = this.props;
    var [timelineTimeStart, timelineTimeEnd] = this.getTimelineTimeInterval();

    // interval should be equal at least 1 second
    var canTimelineBeZoommedIn = millisecondsPerPixel / 2 >= 1000 / timelineIntervalWidth;
    var canTimelineBeZoommedOut =
      millisecondsPerPixel * 2 <=
      this.getTimelineMaxMillisecondsPerPixel(timelineTimeStart, timelineTimeEnd);

    return (
      <div className='deployment-history-table'>
        <DeploymentHistoryManagementPanel
          {... _.pick(this.props,
            'deploymentHistory', 'transaction', 'defaultSorting'
          )}
          {... _.pick(this.state, 'viewMode', 'filters', 'activeSorters', 'availableSorters')}
          {... _.pick(this,
            'changeViewMode',
            'resetFilters', 'changeFilter',
            'addSorting', 'removeSorting', 'changeSortingOrder', 'resetSorters'
          )}
          zoomInTimeline={canTimelineBeZoommedIn && this.zoomInTimeline}
          zoomOutTimeline={canTimelineBeZoommedOut && this.zoomOutTimeline}
        />
        <div className='row'>
          {viewMode === 'timeline' &&
            <DeploymentHistoryTimeline
              {... _.pick(this.props,
                'deploymentHistory', 'width', 'timelineIntervalWidth', 'timelineRowHeight'
              )}
              {... _.pick(this.state, 'millisecondsPerPixel')}
              nodeTimelineContainerWidth={this.getNodeTimelineContainerWidth()}
              timeStart={timelineTimeStart}
              timeEnd={timelineTimeEnd}
              isRunning={transaction.match({status: 'running'})}
            />
          }
          {viewMode === 'table' &&
            <DeploymentHistoryTable
              sorters={activeSorters}
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

var DeploymentHistoryManagementPanel = React.createClass({
  getInitialState() {
    return {
      areFiltersVisible: false,
      openFilter: null,
      areSortersVisible: false,
      isMoreSorterControlVisible: false
    };
  },
  toggleFilters() {
    this.setState({
      areFiltersVisible: !this.state.areFiltersVisible,
      openFilter: false,
      //close activeSorters panel
      areSortersVisible: false,
      isMoreSorterControlVisible: false
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
  toggleSorters() {
    this.setState({
      areSortersVisible: !this.state.areSortersVisible,
      isMoreSorterControlVisible: false,
      //close filters panel
      areFiltersVisible: false,
      openFilter: null
    });
  },
  toggleMoreSorterControl(visible) {
    this.setState({
      isMoreSorterControlVisible: _.isBoolean(visible) ?
        visible : !this.state.isMoreSorterControlVisible
    });
  },
  render() {
    var {
      deploymentHistory, transaction,
      viewMode, changeViewMode,
      zoomInTimeline, zoomOutTimeline,
      filters, resetFilters, changeFilter,
      activeSorters, defaultSorting, availableSorters,
      addSorting, removeSorting, changeSortingOrder, resetSorters
    } = this.props;

    var {
      areFiltersVisible, openFilter,
      areSortersVisible, isMoreSorterControlVisible
    } = this.state;

    var areFiltersApplied = _.some(filters, ({values}) => values.length);

    var inactiveSorters = _.filter(availableSorters, ({name}) => !_.some(activeSorters, {name}));
    var canResetSorters = !_.isEqual(_.map(activeSorters, Sorter.toObject), defaultSorting);

    return (
      <div>
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
                        onClick={() => changeViewMode(mode)}
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
                      onClick={zoomInTimeline}
                      disabled={!zoomInTimeline}
                    >
                      <i className='glyphicon glyphicon-plus-dark' />
                    </button>
                  </Tooltip>
                  <Tooltip text={i18n(ns + 'zoom_out_tooltip')}>
                    <button
                      className='btn btn-default btn-zoom-out pull-left'
                      onClick={zoomOutTimeline}
                      disabled={!zoomOutTimeline}
                    >
                      <i className='glyphicon glyphicon-minus-dark' />
                    </button>
                  </Tooltip>
                </div>
              </div>
            }
            {viewMode === 'table' &&
              <div>
                <Tooltip wrap text={i18n(ns + 'sort_tooltip')}>
                  <button
                    onClick={this.toggleSorters}
                    className={utils.classNames({
                      'btn btn-default pull-left btn-sorters': true,
                      active: areSortersVisible
                    })}
                  >
                    <i className='glyphicon glyphicon-sort' />
                  </button>
                </Tooltip>
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
          {viewMode === 'table' && areSortersVisible && (
            <div className='sorters col-xs-12'>
              <div className='well clearfix'>
                <div className='well-heading'>
                  <i className='glyphicon glyphicon-sort' /> {i18n(ns + 'sort_by')}
                  {canResetSorters &&
                    <button
                      className='btn btn-link pull-right btn-reset-sorters'
                      onClick={resetSorters}
                    >
                      <i className='glyphicon discard-changes-icon' /> {i18n('common.reset_button')}
                    </button>
                  }
                </div>
                {_.map(activeSorters, (sorter) => {
                  var {name, order, title} = sorter;
                  var asc = order === 'asc';
                  return (
                    <div
                      key={'sort_by-' + name}
                      className={utils.classNames(
                        'sorter-control', 'pull-left', 'sort-by-' + name + '-' + order
                      )}
                    >
                      <button
                        className='btn btn-default'
                        onClick={() => changeSortingOrder(sorter)}
                      >
                        {title}
                        <i
                          className={utils.classNames({
                            glyphicon: true,
                            'glyphicon-arrow-down': asc,
                            'glyphicon-arrow-up': !asc
                          })}
                        />
                      </button>
                      {activeSorters.length > 1 &&
                        <i
                          className='btn btn-link glyphicon glyphicon-minus-sign btn-remove-sorter'
                          onClick={() => removeSorting(sorter)}
                        />
                      }
                    </div>
                  );
                })}
                <MultiSelectControl
                  name='sorter-more'
                  label={i18n(ns + 'add_sorter')}
                  options={inactiveSorters}
                  onChange={addSorting}
                  dynamicValues
                  isOpen={isMoreSorterControlVisible}
                  toggle={this.toggleMoreSorterControl}
                />
              </div>
            </div>
          )}
          {viewMode === 'table' && areFiltersVisible && (
            <div className='filters col-xs-12'>
              <div className='well clearfix'>
                <div className='well-heading'>
                  <i className='glyphicon glyphicon-filter' /> {i18n(ns + 'filter_by')}
                  {areFiltersApplied &&
                    <button
                      className='btn btn-link pull-right btn-reset-filters'
                      onClick={resetFilters}
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
                    onChange={_.partial(changeFilter, filter.name)}
                    isOpen={openFilter === filter.name}
                    toggle={_.partial(this.toggleFilter, filter.name)}
                    options={_.map(filter.options, (value) => ({name: value, title: value}))}
                  />
                )}
              </div>
            </div>
          )}
        </div>
        {viewMode === 'table' && (
          !areFiltersVisible && areFiltersApplied ||
          !areSortersVisible && !!activeSorters.length
        ) &&
          <div className='active-sorters-filters'>
            {!areFiltersVisible && areFiltersApplied &&
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
                  onClick={resetFilters}
                >
                  <i className='glyphicon discard-changes-icon' />
                </button>
              </div>
            }
            {!areSortersVisible &&
              <div className='active-sorters row' onClick={this.toggleSorters}>
                <strong className='col-xs-1'>{i18n(ns + 'sort_by')}</strong>
                <div className='col-xs-11'>
                  {activeSorters.map(({name, order, title}, index) => {
                    var asc = order === 'asc';
                    return (
                      <span key={name}>
                        {title}
                        <i
                          className={utils.classNames({
                            glyphicon: true,
                            'glyphicon-arrow-down': asc,
                            'glyphicon-arrow-up': !asc
                          })}
                        />
                        {!!activeSorters[index + 1] && ' + '}
                      </span>
                    );
                  })}
                </div>
                {canResetSorters &&
                  <button
                    className='btn btn-reset-sorters'
                    onClick={resetSorters}
                  >
                    <i className='glyphicon discard-changes-icon' />
                  </button>
                }
              </div>
            }
          </div>
        }
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
    var taskStatus = task.get('status');
    return <div
      onMouseEnter={() => this.togglePopover(true)}
      onMouseLeave={() => this.togglePopover(false)}
      className='node-task'
      style={{background: this.getColorFromString(taskName), top, left, width}}
    >
      {taskStatus === 'error' &&
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
              .map((attr) => !_.isNull(task.get(attr)) && (
                <div key={attr} className={utils.classNames('row', attr, taskStatus)}>
                  <span className='col-xs-3'>
                    {i18n('dialog.deployment_task_details.task.' + attr)}
                  </span>
                  <span className='col-xs-9'>
                    {_.startsWith(attr, 'time') ?
                      utils.formatTimestamp(task.get(attr)) : task.get(attr)
                    }
                  </span>
                </div>
              ))
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
  componentWillUpdate() {
    var {scrollLeft, scrollWidth, clientWidth} = this.refs.timelines;
    if (scrollLeft === (scrollWidth - clientWidth)) {
      this.scrollToRight = true;
    }
  },
  componentDidUpdate() {
    if (this.scrollToRight) {
      this.refs.timelines.scrollLeft = this.refs.timelines.scrollWidth;
      delete this.scrollToRight;
    }
  },
  render() {
    var {
      deploymentHistory, timeStart, timeEnd, isRunning,
      nodeTimelineContainerWidth, width, timelineIntervalWidth, timelineRowHeight
    } = this.props;

    var nodeIds = [];
    var nodeOffsets = {};
    deploymentHistory.each((task) => {
      var nodeId = task.get('node_id');
      if (_.has(nodeOffsets, nodeId)) return;
      nodeOffsets[nodeId] = nodeIds.length;
      nodeIds.push(nodeId);
    });
    nodeIds.sort(
      (id1, id2) => id1 === id2 ? 0 : id1 === 'master' ? -1 : id2 === 'master' ? 1 : id1 - id2
    );

    var nodeTimelineWidth = _.max([
      this.getTimeIntervalWidth(timeStart, timeEnd),
      nodeTimelineContainerWidth
    ]);
    var intervals = Math.floor(nodeTimelineWidth / timelineIntervalWidth);

    return (
      <div className='col-xs-12'>
        <div className='deployment-timeline clearfix'>
          <div className='node-names-column' style={{width: width - nodeTimelineContainerWidth}}>
            <div className='header' />
            <div className='node-names-container'>
              <div className='node-names' ref='names'>
                {_.map(nodeIds,
                  (nodeId) => <div key={nodeId} style={{height: timelineRowHeight}}>
                    {nodeId === 'master' ? nodeId : '#' + nodeId}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className='timelines-column' style={{width: nodeTimelineContainerWidth}}>
            <div className='header'>
              <div className='scale' ref='scale' style={{width: nodeTimelineWidth}}>
                {_.times(intervals, (n) =>
                  <div
                    key={n}
                    style={{
                      width: timelineIntervalWidth,
                      right: (intervals - (n + 1)) * timelineIntervalWidth
                    }}
                  >
                    {this.getIntervalLabel(n)}
                  </div>
                )}
              </div>
            </div>
            <div className='timelines-container' ref='timelines' onScroll={this.adjustOffsets}>
              <div
                className='timelines'
                style={{
                  width: nodeTimelineWidth,
                  height: nodeIds.length * timelineRowHeight
                }}
              >
                {deploymentHistory.map((task) => {
                  if (!_.includes(['ready', 'error', 'running'], task.get('status'))) return null;

                  var taskTimeStart = task.get('time_start') ?
                    parseISO8601Date(task.get('time_start')) : 0;
                  var taskTimeEnd = task.get('time_end') ?
                    parseISO8601Date(task.get('time_end')) : timeEnd;

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
  sortDeploymentTasks({deploymentTasks, sorters}) {
    var comparators = {
      node_id: (attr1, attr2) =>
        attr1 === attr2 ? 0 : attr1 === 'master' ? -1 : attr2 === 'master' ? 1 : attr1 - attr2,
      task_name: (attr1, attr2) => utils.natsort(attr1, attr2),
      status: (attr1, attr2) => _.indexOf(DEPLOYMENT_TASK_STATUSES, attr1) -
        _.indexOf(DEPLOYMENT_TASK_STATUSES, attr2),
      time_start: (attr1, attr2) => parseISO8601Date(attr1) - parseISO8601Date(attr2),
      time_end: (attr1, attr2) => parseISO8601Date(attr1) - parseISO8601Date(attr2)
    };
    deploymentTasks.sort((task1, task2) => {
      var result;
      _.each(sorters, ({name, order}) => {
        result = comparators[name](task1.get(name), task2.get(name));
        if (order === 'desc') result = result * -1;
        return result === 0;
      });
      return result;
    });
  },
  componentWillMount() {
    this.sortDeploymentTasks(this.props);
  },
  componentWillUpdate(newProps) {
    this.sortDeploymentTasks(newProps);
  },
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
