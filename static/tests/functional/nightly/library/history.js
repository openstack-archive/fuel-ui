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

import 'tests/functional/helpers';
import assert from 'intern/chai!assert';
import moment from 'intern/dojo/node!moment';
import ModalWindow from 'tests/functional/pages/modal';
import GenericLib from 'tests/functional/nightly/library/generic';

class HistoryLib {
  constructor(remote) {
    this.remote = remote;
    this.modal = new ModalWindow(remote);
    this.genericLib = new GenericLib(remote);
  }

  compareViewsData(rowNumber, nodeName) {
    var taskName, taskStatus, startTime, endTime;
    var historyToolbarSelector = 'div.deployment-history-toolbar ';
    var timelineViewButton = historyToolbarSelector + 'label.timeline-view';
    var tableViewButton = historyToolbarSelector + 'label.table-view';
    var timelinePaneSelector = 'div.deployment-timeline ';
    var tablePaneSelector = 'div.history-table table ';
    var tableBodyRow = tablePaneSelector + 'tbody tr';
    var nodeTaskItem = timelinePaneSelector + 'div.timelines div.node-task';
    var taskPopover = 'div.popover.deployment-task-info div.popover-content ';
    var popoverTaskName = taskPopover + 'div.task_name ';
    var popoverStatus = taskPopover + 'div.status ';
    var popoverStartTime = taskPopover + 'div.time_start ';
    var popoverEndTime = taskPopover + 'div.time_end ';
    var taskDetailsAttribure = 'div.deployment-task-details-dialog div.modal-body div.row';
    return this.remote
      .clickByCssSelector(timelineViewButton)
      .assertElementsAppear(timelinePaneSelector, 5000, '"Timeline pane" appears')
      .assertElementsAppear(nodeTaskItem, 5000, 'Node task appears')
      .sleep(1000)
      .then(() => this.genericLib.moveCursorTo(nodeTaskItem + ':nth-child(' + rowNumber + ')'))
      .assertElementsAppear(taskPopover, 5000, 'Node task popover appears')
      .findByCssSelector(popoverTaskName + 'span:last-child')
        .getVisibleText()
        .then((value) => {taskName = value;})
        .end()
      .findByCssSelector(popoverStatus + 'span:last-child')
        .getVisibleText()
        .then((value) => {taskStatus = value;})
        .end()
      .findByCssSelector(popoverStartTime + 'span:last-child')
        .getVisibleText()
        .then((value) => {startTime = value;})
        .end()
      .findByCssSelector(popoverEndTime + 'span:last-child')
        .getVisibleText()
        .then((value) => {endTime = value;})
        .end()
      .clickByCssSelector(tableViewButton)
      .assertElementsAppear(tablePaneSelector, 5000, '"Table pane" appears')
      .findByCssSelector(tableBodyRow + ':nth-child(' + rowNumber + ') td:nth-child(1)')
        .getVisibleText()
        .then((value) => assert.equal(value, taskName, 'Task name is the same in the table'))
        .end()
      .findByCssSelector(tableBodyRow + ':nth-child(' + rowNumber + ') td:nth-child(2)')
        .getVisibleText()
        .then((value) => assert.equal(value, nodeName, 'Node name is the same in the table'))
        .end()
      .findByCssSelector(tableBodyRow + ':nth-child(' + rowNumber + ') td:nth-child(3)')
        .getVisibleText()
        .then((value) => assert.equal(value, taskStatus, 'Task status is the same in the table'))
        .end()
      .findByCssSelector(tableBodyRow + ':nth-child(' + rowNumber + ') td:nth-child(5)')
        .getVisibleText()
        .then((value) => assert.equal(value, startTime, 'Start time is the same in the table'))
        .end()
      .findByCssSelector(tableBodyRow + ':nth-child(' + rowNumber + ') td:nth-child(6)')
        .getVisibleText()
        .then((value) => assert.equal(value, endTime, 'End time is the same in the table'))
        .end()
      .clickByCssSelector(tableBodyRow + ':nth-child(' + rowNumber + ') td:nth-child(7) button')
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle('Deployment Task Details'))
      .assertElementsExist(taskDetailsAttribure, 'Attribute is presented at task details dialog')
      .findByCssSelector(taskDetailsAttribure + ':nth-child(1) span')
        .getVisibleText()
        .then((value) => assert.equal(value, taskName, 'Task name is the same in the dialog'))
        .end()
      .findByCssSelector(taskDetailsAttribure + ':nth-child(2) span')
        .getVisibleText()
        .then((value) => assert.equal(value, nodeName, 'Node name is the same in the dialog'))
        .end()
      .findByCssSelector(taskDetailsAttribure + ':nth-child(3) span')
        .getVisibleText()
        .then((value) => assert.equal(value, taskStatus, 'Task status is the same in the dialog'))
        .end()
      .findByCssSelector(taskDetailsAttribure + ':nth-child(5) span')
        .getVisibleText()
        .then((value) => assert.equal(value, startTime, 'Start time is the same in the dialog'))
        .end()
      .findByCssSelector(taskDetailsAttribure + ':nth-child(6) span')
        .getVisibleText()
        .then((value) => assert.equal(value, endTime, 'End time is the same in the dialog'))
        .end()
      .then(() => this.modal.clickFooterButton('Close'))
      .then(() => this.modal.waitToClose());
  }

  waitForZeroSeconds() {
    return this.remote
      .then(() => {
        if (parseInt(moment().format('ss'), 10) >= 50) {
          return this.remote.sleep(10000);
        } else {
          return false;
        }
      });
  }
}

export default HistoryLib;
