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
import {Table, Tooltip, Popover, MultiSelectControl, DownloadFileButton} from 'views/controls';
import {DeploymentTaskDetailsDialog, ShowNodeInfoDialog} from 'views/dialogs';
import {
  DEPLOYMENT_HISTORY_VIEW_MODES, DEPLOYMENT_TASK_STATUSES, DEPLOYMENT_TASK_ATTRIBUTES,
  NODE_STATUSES
} from 'consts';
import {Sorter} from 'views/cluster_page_tabs/nodes_tab_screens/node_list_screen';

var ns = 'cluster_page.deployment_history.';

var {parseRFC2822Date, parseISO8601Date, formatTimestamp} = utils;

var DeploymentHistory = React.createClass({
  propTypes: {
    width: React.PropTypes.number.isRequired
  },
  getDefaultProps() {
    return {
      timelineIntervalWidth: 75,
      timelineRowHeight: 28
    };
  },
  getInitialState() {
    var {deploymentHistory} = this.props;
    return {
      viewMode: 'timeline',
      filters: [
        {
          name: 'task_name',
          label: i18n(ns + 'filter_by_task_name'),
          values: [],
          options: _.map(_.uniq(deploymentHistory.map('task_name')).sort(),
            (taskName) => ({name: taskName, title: taskName})
          ),
          addOptionsFilter: true
        }, {
          name: 'node_id',
          label: i18n(ns + 'filter_by_node'),
          values: [],
          options: _.map(_.uniq(deploymentHistory.map('node_id')),
            (nodeId) => ({name: nodeId, title: renderNodeName.call(this, nodeId, false)})
          ),
          addOptionsFilter: true
        }, {
          name: 'status',
          label: i18n(ns + 'filter_by_status'),
          values: [],
          options: _.map(DEPLOYMENT_TASK_STATUSES,
            (status) => ({name: status, title: status})
          )
        }
      ],
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
  render() {
    var {viewMode, filters, millisecondsPerPixel} = this.state;
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
          {... _.pick(this.props, 'deploymentHistory', 'transaction')}
          {... _.pick(this.state, 'viewMode', 'filters')}
          {... _.pick(this, 'changeViewMode', 'resetFilters', 'changeFilter')}
          zoomInTimeline={canTimelineBeZoommedIn && this.zoomInTimeline}
          zoomOutTimeline={canTimelineBeZoommedOut && this.zoomOutTimeline}
        />
        <div className='row'>
          {viewMode === 'timeline' &&
            <DeploymentHistoryTimeline
              {... _.pick(this.props,
                'deploymentHistory', 'cluster', 'nodes', 'nodeNetworkGroups',
                'width', 'timelineIntervalWidth', 'timelineRowHeight'
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
              {... _.pick(this.props, 'cluster', 'nodes', 'nodeNetworkGroups')}
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
      openFilter: null
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
  render() {
    var {
      deploymentHistory, transaction,
      viewMode, changeViewMode,
      zoomInTimeline, zoomOutTimeline,
      filters, resetFilters, changeFilter
    } = this.props;

    var {areFiltersVisible, openFilter} = this.state;

    var areFiltersApplied = _.some(filters, ({values}) => values.length);

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
            <DownloadFileButton
              label={i18n(ns + 'export_csv')}
              fileName={'deployment#' + transaction.id + '.csv'}
              url={deploymentHistory.url}
              headers={{Accept: 'text/csv'}}
              className='btn btn-default pull-right btn-export-history-csv'
              showProgressBar='inline'
            />
          </div>
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
                {_.map(filters, ({name, label, values, options}) => {
                  if (!values.length) return null;
                  return <div key={name}>
                    <strong>{label + ':'}</strong> <span>
                      {_.map(values, (value) => _.find(options, {name: value}).title).join(', ')}
                    </span>
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
      onClick={() => {
        this.togglePopover(false);
        DeploymentTaskDetailsDialog.show({task});
      }}
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
            {_.without(DEPLOYMENT_TASK_ATTRIBUTES, 'node_id')
              .map((attr) => !_.isNull(task.get(attr)) && (
                <div key={attr} className={utils.classNames('row', attr, taskStatus)}>
                  <span className='col-xs-3'>
                    {i18n('dialog.deployment_task_details.task.' + attr)}
                  </span>
                  <span className='col-xs-9'>
                    {attr === 'time_start' || attr === 'time_end' ?
                      formatTimestamp(parseISO8601Date(task.get(attr))) : task.get(attr)
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

// Prefer to keep this as a function, not a component, since components
// don't allow to return plain text and I'd really prefer not to create extra
// useless spans
function renderNodeName(nodeId, isClickable = true) {
  if (nodeId === 'master') {
    return i18n(ns + 'master_node');
  }
  var node = this.props.nodes.get(nodeId);
  if (!node) {
    return i18n(ns + 'deleted_node', {id: nodeId});
  }
  if (isClickable) {
    return (
      <button
        className='btn btn-link'
        onClick={() => ShowNodeInfoDialog.show({
          node,
          cluster: this.props.cluster,
          nodeNetworkGroup: this.props.nodeNetworkGroups.get(node.get('group_id'))
        })}
      >
        <div>{node.get('name')}</div>
      </button>
    );
  }
  return node.get('name');
}

var DeploymentHistoryTimeline = React.createClass({
  renderIntervalLabel(index) {
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
      cluster, deploymentHistory, timeStart, timeEnd, isRunning,
      nodeTimelineContainerWidth, width, timelineIntervalWidth, timelineRowHeight
    } = this.props;

    var nodeIds = _.uniq(deploymentHistory.map('node_id'));
    var {sort, sort_by_labels: sortByLabels} = cluster.get('ui_settings');
    var nodeListSorters = _.union(
      _.map(sort, _.partial(Sorter.fromObject, _, false)),
      _.map(sortByLabels, _.partial(Sorter.fromObject, _, true))
    );

    nodeIds.sort((id1, id2) => {
      // master node should go first
      if (id1 === 'master') return -1;
      if (id2 === 'master') return 1;

      var node1 = cluster.get('nodes').get(id1);
      var node2 = cluster.get('nodes').get(id2);

      // removed nodes should go last
      if (!node1 || !node2) {
        if (node1) return -1;
        if (node2) return 1;
        return id1 - id2;
      }

      // apply user defined sorting to cluster nodes
      var result;
      var preferredRolesOrder = cluster.get('roles').map('name');
      var composeNodeDiskSizesLabel = (node) => {
        var diskSizes = node.resource('disks');
        return i18n('node_details.disks_amount', {
          count: diskSizes.length,
          size: diskSizes.map(
            (size) => utils.showSize(size) + ' ' + i18n('node_details.hdd')
          ).join(', ')
        });
      };
      _.each(nodeListSorters, (sorter) => {
        if (sorter.isLabel) {
          var node1Label = node1.getLabel(sorter.name);
          var node2Label = node2.getLabel(sorter.name);
          if (node1Label && node2Label) {
            result = utils.natsort(node1Label, node2Label, {insensitive: true});
          } else {
            result = node1Label === node2Label ? 0 : _.isString(node1Label) ? -1 :
              _.isNull(node1Label) ? -1 : 1;
          }
        } else {
          var comparators = {
            roles: () => {
              var roles1 = node1.sortedRoles(preferredRolesOrder);
              var roles2 = node2.sortedRoles(preferredRolesOrder);
              var order;
              if (!roles1.length && !roles2.length) {
                result = 0;
              } else if (!roles1.length) {
                result = 1;
              } else if (!roles2.length) {
                result = -1;
              } else {
                while (!order && roles1.length && roles2.length) {
                  order = _.indexOf(preferredRolesOrder, roles1.shift()) -
                    _.indexOf(preferredRolesOrder, roles2.shift());
                }
                result = order || roles1.length - roles2.length;
              }
            },
            status: () => {
              var status1 = !node1.get('online') ? 'offline' : node1.get('status');
              var status2 = !node2.get('online') ? 'offline' : node2.get('status');
              result = _.indexOf(NODE_STATUSES, status1) - _.indexOf(NODE_STATUSES, status2);
            },
            disks: () => {
              result = utils.natsort(
                composeNodeDiskSizesLabel(node1),
                composeNodeDiskSizesLabel(node2)
              );
            },
            group_id: () => {
              var nodeGroup1 = node1.get('group_id');
              var nodeGroup2 = node2.get('group_id');
              result = nodeGroup1 === nodeGroup2 ? 0 :
                !nodeGroup1 ? 1 : !nodeGroup2 ? -1 : nodeGroup1 - nodeGroup2;
            },
            default: () => {
              result = node1.resource(sorter.name) - node2.resource(sorter.name);
            }
          };

          if (!_.includes(['name', 'ip', 'mac', 'manufacturer'], sorter.name)) {
            (comparators[sorter.name] || comparators.default)();
          } else {
            result = utils.natsort(node1.get(sorter.name), node2.get(sorter.name));
          }
        }

        if (sorter.order === 'desc') result = result * -1;

        return result === 0;
      });

      return result === 0 ? id1 - id2 : result;
    });

    var nodeOffsets = {};
    _.each(nodeIds, (nodeId, index) => {
      nodeOffsets[nodeId] = index;
    });

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
                    {renderNodeName.call(this, nodeId)}
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
                    {this.renderIntervalLabel(n)}
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
                .map((attr) => {
                  if (attr === 'time_start' || attr === 'time_end') {
                    return formatTimestamp(parseISO8601Date(task.get(attr)));
                  } else if (attr === 'node_id') {
                    return renderNodeName.call(this, task.get(attr));
                  } else {
                    return task.get(attr);
                  }
                })
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
