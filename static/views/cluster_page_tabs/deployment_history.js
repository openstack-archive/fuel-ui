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
import ReactDOM from 'react-dom';
import models from 'models';
import utils from 'utils';
import {DEPLOYMENT_HISTORY_VIEW_MODES, DEPLOYMENT_TASK_STATUSES} from 'consts';
import {Input, Tooltip, Popover, Table} from 'views/controls';
import {TaskDetailsDialog} from 'views/dialogs';

var ns = 'cluster_page.deployment_history.';

var DeploymentHistory = React.createClass({
  getInitialState() {
    return {
      viewMode: 'timeline',
      filterByTaskName: null,
      filterByTaskStatus: null
    };
  },
  renderableTaskAttributes: ['task_name', 'status', 'time_start', 'time_end'],
  changeViewMode(viewMode) {
    if (viewMode === this.state.viewMode) return;
    this.setState({viewMode});
  },
  applyFilter(name, value) {
    this.setState({[name]: value || null});
  },
  showTaskDetails(taskData) {
    TaskDetailsDialog.show({
      taskData,
      preferredAttributesOrder: this.renderableTaskAttributes
    });
  },
  render() {
    var {viewMode, filterByTaskName, filterByTaskStatus} = this.state;
    var {cluster, history} = this.props;

    // show master node tasks first
    var nodeIds = ['master'].concat(
      _.without(_.compact(_.uniq(history.map('node_id'))), 'master')
    );

    return (
      <div className='deployment-history-table'>
        <div className='deployment-history-toolbar well clearfix'>
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
                      <i
                        className={utils.classNames({
                          glyphicon: true,
                          'glyphicon-th-list': mode === 'timeline',
                          'glyphicon-th': mode === 'table'
                        })}
                      />
                    </label>
                  </Tooltip>
                );
              })}
            </div>
          </div>
          {viewMode === 'table' &&
            <div className='history-filters pull-right'>
              <Input
                type='select'
                name='filterByTaskName'
                value={filterByTaskName}
                label={i18n(ns + 'filter_by')}
                onChange={this.applyFilter}
              >
                {
                  [<option key='default' value=''>{i18n(ns + 'filter_by_task_name')}</option>]
                    .concat(
                      _.uniq(history.map('task_name')).sort().map(
                        (name) => <option key={name} value={name}>{name}</option>
                      )
                    )
                }
              </Input>
              <Input
                type='select'
                name='filterByTaskStatus'
                value={filterByTaskStatus}
                onChange={this.applyFilter}
              >
                {
                  [<option key='default' value=''>{i18n(ns + 'filter_by_task_status')}</option>]
                    .concat(
                      DEPLOYMENT_TASK_STATUSES.map(
                        (status) => <option key={status} value={status}>{status}</option>
                      )
                    )
                }
              </Input>
            </div>
          }
        </div>
        {viewMode === 'table' &&
          _.map(nodeIds, (nodeId) => {
            var nodeDeploymentTasks = history.filter({node_id: nodeId});
            var clusterNode = cluster.get('nodes').get(nodeId);
            return (
              <div className='node-history-table' key={nodeId}>
                <div className='node-history-table-title'>
                  {nodeId === 'master' ?
                    i18n(ns + 'master_node_history_table_title')
                  :
                    i18n(
                      ns + 'node_history_table_title',
                      {node: clusterNode ? clusterNode.get('name') : nodeId}
                    )
                  }
                </div>
                <Table
                  head={
                    this.renderableTaskAttributes
                      .map((attr) => ({label: i18n(ns + attr + '_header')}))
                      .concat([{label: ''}])
                  }
                  body={_.map(nodeDeploymentTasks, (task) => {
                    if (
                      (!_.isNull(filterByTaskName) && task.get('task_name') !== filterByTaskName) ||
                      (!_.isNull(filterByTaskStatus) && task.get('status') !== filterByTaskStatus)
                    ) return;
                    return this.renderableTaskAttributes
                      .map((attr) => {
                        if (_.startsWith(attr, 'time')) {
                          return utils.formatTimestamp(task.get(attr));
                        }
                        return task.get(attr);
                      })
                      .concat([
                        <button
                          key={task.get('task_name') + 'details'}
                          className='btn btn-link'
                          onClick={() => this.showTaskDetails(task.attributes)}
                        >{i18n(ns + 'task_details')}</button>
                      ]);
                  })}
                />
              </div>
            );
          })
        }
        {viewMode === 'timeline' &&
          <DeploymentTimeline
            cluster={cluster}
            nodeIds={nodeIds}
            history={history}
          />
        }
      </div>
    );
  }
});

var DeploymentTimeline = React.createClass({
  getInitialState() {
    return {
      secPerPx: 4,
      lastScrollTop: 0
    };
  },
  changeScale(secPerPx) {
    this.setState({secPerPx});
  },
  onWheel(e) {
    if (e.nativeEvent.deltaY < 0) {
      // scrolling up
      this.setState({secPerPx: this.state.secPerPx / 2});
    } else {
      // scrolling down
      this.setState({secPerPx: this.state.secPerPx * 2});
    }
  },
  render() {
    var {cluster, history, nodeIds} = this.props;
    var {secPerPx} = this.state;

    var isRunning = history.some({status: 'pending'});
    //isRunning = true;

    var getTime = (date) => (Date.parse(new Date(date).toUTCString()) / 1000);

    var timeStart = _.min(history.map((task) => getTime(task.get('time_start'))));
    var timeEnd = isRunning ? _.now() : _.max(history.map((task) => getTime(task.get('time_end'))));
    //timeStart = timeEnd - 40 * 60;

    var intervals = Math.ceil((timeEnd - timeStart) / (5 * 60)) + 1;
    var delimiter = <div className='delimiter'><div className='node' /></div>;

    var getPx = (start, end) => Math.floor((end - start) / secPerPx);

    return (
      <div className='deployment-timeline clearfix' ref='timeline' onWheel={this.onWheel}>
        <div className='timeline-header clearfix'>
          <div className='node' />
          <div className='timeline clearfix'>
            {_.times(intervals, (n) => {
              var minutes = 5 * (n + 1);
              var hours = minutes < 60 ? 0 : Math.floor(minutes / 60);
              minutes = minutes - (hours * 60);
              var width = (5 * 60) / secPerPx;
              return <div key={n} style={{width}}>
                {width > 20 && (
                  hours ? i18n(ns + 'hours', {hours, minutes}) : i18n(ns + 'minutes', {minutes})
                )}
              </div>;
            })}
          </div>
        </div>
        <div className='timeline-body'>
          {isRunning &&
            <div
              className='current-time'
              style={{left: getPx(timeStart, timeEnd) + 250}}
            />
          }
          {delimiter}
          {_.map(nodeIds, (nodeId) => {
            var clusterNode = cluster.get('nodes').get(nodeId);
            var tasks = history.filter(
              (task) => task.get('node_id') === nodeId &&
                _.includes(['ready', 'error', 'running'], task.get('status'))
            );
            //if (nodeId === 1) {
            //  tasks = new models.DeploymentHistory([
            //    {
            //      node_id: 1,
            //      task_name: 'task1',
            //      status: 'ready',
            //      time_start: timeEnd - 40 * 60,
            //      time_end: timeEnd - 38 * 60
            //    },
            //    {
            //      node_id: 1,
            //      task_name: 'task2',
            //      status: 'ready',
            //      time_start: timeEnd - 30 * 60,
            //      time_end: timeEnd - 20 * 60
            //    },
            //    {
            //      node_id: 1,
            //      task_name: 'task3',
            //      status: 'running',
            //      time_start: timeEnd - 10 * 60,
            //      time_end: null
            //    }
            //  ]);
            //}
            //if (nodeId === 2) {
            //  tasks = new models.DeploymentHistory([
            //    {
            //      node_id: 2,
            //      task_name: 'task1',
            //      status: 'ready',
            //      time_start: timeEnd - 33 * 60,
            //      time_end: timeEnd - 29 * 60
            //    },
            //    {
            //      node_id: 2,
            //      task_name: 'task2',
            //      status: 'ready',
            //      time_start: timeEnd - 26 * 60,
            //      time_end: timeEnd - 9 * 60
            //    },
            //    {
            //      node_id: 2,
            //      task_name: 'task3',
            //      status: 'error',
            //      time_start: timeEnd - 9 * 60,
            //      time_end: timeEnd - 5 * 60
            //    }
            //  ]);
            //}
            //if (nodeId === 'master') {
            //  tasks = new models.DeploymentHistory([
            //    {
            //      node_id: 'master',
            //      task_name: 'taskM1',
            //      status: 'ready',
            //      time_start: timeEnd - 37 * 60,
            //      time_end: timeEnd - 35 * 60
            //    },
            //    {
            //      node_id: 'master',
            //      task_name: 'taskM2',
            //      status: 'ready',
            //      time_start: timeEnd - 34 * 60,
            //      time_end: timeEnd - 13 * 60
            //    }
            //  ]);
            //}
            var backgrounds = _.times(70, () => '#' + Math.random().toString(16).slice(2, 8));
            return <NodeTimeline
              key={nodeId}
              {... _.pick(this.props, 'timeStart', 'timeEnd')}
              label={
                nodeId === 'master' ?
                  i18n(ns + 'master_node_history_table_title')
                :
                  i18n(
                    ns + 'node_history_table_title',
                    {node: clusterNode ? clusterNode.get('name') : nodeId}
                  )
              }
              tasks={tasks}
              getPx={getPx}
              getTime={getTime}
              timeStart={timeStart}
              timeEnd={timeEnd}
              backgrounds={backgrounds}
            />;
          })}
          {delimiter}
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
    var {label, tasks, timeStart, timeEnd, getPx, getTime, backgrounds} = this.props;
    return (
      <div className='node-timeline'>
        <div className='node'>{label}</div>
        <div className='timeline'>
          {tasks.map((task, index) => {
            var taskName = task.get('task_name');
            var left = getPx(timeStart, getTime(task.get('time_start')));
            var width = getPx(getTime(task.get('time_start')), task.get('time_end') ? getTime(task.get('time_end')) : timeEnd);
            return <div
              key={taskName}
              className='node-task'
              onMouseEnter={() => this.togglePopover(taskName)}
              onMouseLeave={() => this.togglePopover(null)}
              style={{background: backgrounds[index], left, width}}
            >
              {task.get('status') === 'error' &&
                <div
                  className='error-marker'
                  style={{left: Math.floor((width - 6) / 2)}}
                />
              }
              <div className='popover-container'>
                {this.state.openPopover === taskName &&
                  <Popover placement='bottom' className='task-popover'>
                    <div className='task-data'>
                      <p>{'Task: ' + taskName}</p>
                      <p>{'Status: ' + task.get('status')}</p>
                      <p>{'Started: ' + utils.formatTimestamp(task.get('time_start'))}</p>
                      {task.get('time_end') &&
                        <p>{'Finished: ' + utils.formatTimestamp(task.get('time_end'))}</p>
                      }
                    </div>
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

export default DeploymentHistory;
