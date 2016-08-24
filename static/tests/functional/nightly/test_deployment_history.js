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

import registerSuite from 'intern!object';
import assert from 'intern/chai!assert';
import moment from 'intern/dojo/node!moment';
import Common from 'tests/functional/pages/common';
import pollUntil from 'intern/dojo/node!leadfoot/helpers/pollUntil';
import Command from 'intern/dojo/node!leadfoot/Command';
import ClusterPage from 'tests/functional/pages/cluster';
import ClustersPage from 'tests/functional/pages/clusters';
import DashboardPage from 'tests/functional/pages/dashboard';
import NodesLib from 'tests/functional/nightly/library/nodes';
import GenericLib from 'tests/functional/nightly/library/generic';
import HistoryLib from 'tests/functional/nightly/library/history';
import 'tests/functional/helpers';

registerSuite(() => {
  var common, clusterPage, clustersPage, dashboardPage, nodesLib, genericLib, historyLib, command,
    clusterName, currentTime, currentDate, controllerName;
  var progressSelector = 'div.dashboard-tab div.progress';
  var showDetailsSelector = 'div.toggle-history button';

  var historyTabSelector = 'div.history-tab ';
  var historyTitleSelector = historyTabSelector + 'div.title';
  var historyAlertSelector = historyTabSelector + 'div.alert';
  var historyLineSelector = historyTabSelector + 'div.transaction-list ';
  var historyPointSelector = historyLineSelector + 'a.transaction-link.ready';
  var historyPointText = 'Deployment\n';
  var historyToolbarSelector = 'div.deployment-history-toolbar ';
  var timelineViewButton = historyToolbarSelector + 'label.timeline-view';
  var tableViewButton = historyToolbarSelector + 'label.table-view';
  var filterTasksButton = historyToolbarSelector + 'button.btn-filters';
  var exportCSVButton = historyToolbarSelector + 'button.btn-export-history-csv';
  var zoomInButton = historyToolbarSelector + 'button.btn-zoom-in';
  var zoomOutButton = historyToolbarSelector + 'button.btn-zoom-out';

  var timelinePaneSelector = 'div.deployment-timeline ';
  var nodeNameLink = timelinePaneSelector + 'div.node-names button.btn-link';
  var nodeTaskItem = timelinePaneSelector + 'div.timelines div.node-task';
  var taskPopover = 'div.popover.deployment-task-info div.popover-content ';
  var popoverTaskName = taskPopover + 'div.task_name ';
  var popoverStatus = taskPopover + 'div.status ';
  var popoverStartTime = taskPopover + 'div.time_start ';
  var popoverEndTime = taskPopover + 'div.time_end ';
  var tablePaneSelector = 'div.history-table table ';
  var tableBodyRow = tablePaneSelector + 'tbody tr';

  return {
    name: 'Deployment History',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clustersPage = new ClustersPage(this.remote);
      dashboardPage = new DashboardPage(this.remote);
      nodesLib = new NodesLib(this.remote);
      genericLib = new GenericLib(this.remote);
      historyLib = new HistoryLib(this.remote);
      command = new Command(this.remote);
      clusterName = common.pickRandomName('Deployment History');

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']));
    },
    'Check "History" tab before deployment'() {
      return this.remote
        .then(() => clusterPage.goToTab('History'))
        .assertElementAppears(historyTabSelector, 5000, '"History" tab appears')
        .assertElementExists(historyTitleSelector, '"Deployment History" title exists')
        .assertElementMatchesRegExp(historyTitleSelector, /Deployment History/i,
          '"Deployment History" title has correct description')
        .assertElementExists(historyAlertSelector, 'Alert message exists')
        .assertElementMatchesRegExp(historyAlertSelector, /No deployment finished yet./i,
          'Alert message is correct');
    },
    'Check "History" tab after deployment'() {
      this.timeout = 60000;
      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => {
          if (parseInt(moment().format('ss'), 10) >= 50) {
            return this.remote.sleep(10000);
          } else {
            return false;
          }
        })
        .then(() => dashboardPage.startDeployment())
        .then(() => {currentDate = historyPointText + moment().format('HH:mm DD/MM/YYYY');})
        .then(() => clusterPage.goToTab('History'))
        .assertElementDisappears(historyAlertSelector, 45000, 'Deployment is successful')
        .assertElementExists(historyTitleSelector, '"Deployment History" title exists')
        .assertElementMatchesRegExp(historyTitleSelector, /Deployment History/i,
          '"Deployment History" title has correct description')
        .assertElementExists(historyLineSelector, '"History line" pane exists')
        .assertElementsExist(historyPointSelector + '.active', 1,
          'Only 1 point of "history line" is observed and selected after deployment')
        .findByCssSelector(historyPointSelector)
          .getVisibleText()
          .then((actualText) => assert.equal(actualText, currentDate,
            '"History point" has correct description, time and date'))
          .end()
        .assertElementEnabled(timelineViewButton + '.active',
          '"Timeline View" button exists and active')
        .assertElementEnabled(tableViewButton + ':not(.active)',
          '"Table View" button exists and not active')
        .assertElementExists(exportCSVButton + ':enabled', '"Export CSV" button exists and enabled')
        .assertElementExists(zoomInButton + ':disabled', '"Zoom In" button exists and disabled')
        .assertElementExists(zoomOutButton + ':disabled', '"Zoom Out" button exists and disabled')
        .assertElementExists(timelinePaneSelector, '"Timeline pane" exists and opened by default')
        // Check that user can switch between "Timeline View" and "Table View"
        .clickByCssSelector(tableViewButton)
        .assertElementsAppear(tablePaneSelector, 5000, '"Table pane" appears')
        .assertElementEnabled(timelineViewButton + ':not(.active)',
          '"Timeline View" button exists and not active')
        .assertElementEnabled(tableViewButton + '.active', '"Table View" button exists and active')
        .assertElementExists(filterTasksButton + ':enabled',
          '"Filter Tasks" button exists and enabled')
        .assertElementExists(exportCSVButton + ':enabled', '"Export CSV" button exists and enabled')
        .clickByCssSelector(timelineViewButton)
        .assertElementsAppear(timelinePaneSelector, 5000, '"Timeline pane" appears');
    },
    'Check "History" tab after second cluster deployment'() {
      this.timeout = 90000;
      var deploymentDate;
      var d = currentDate;
      var activeHistoryPoint = historyPointSelector + '.active';
      var inactiveHistoryPoint = historyPointSelector + ':not(.active)';
      var lgreyColor = 'rgba(220, 220, 220, 1)';
      var greyColor = 'rgba(200, 200, 200, 1)';
      var lblueColor = 'rgba(90, 143, 179, 1)';
      var blueColor = 'rgba(69, 117, 149, 1)';
      var dblueColor = 'rgba(35, 82, 124, 1)';
      var lgreenColor = 'rgba(84, 168, 84, 1)';
      var greenColor = 'rgba(64, 148, 64, 1)';
      return this.remote
        // Check that "Deployment History" timeline is worked
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        // To avoid the same deployment time from first deployment
        .then(() => {
          if (parseInt(d.split(' ')[0].split(':')[1], 10) === parseInt(moment().format('mm'), 10)) {
            return this.remote.sleep((60 - parseInt(moment().format('ss'), 10)) * 1000);
          } else {
            return false;
          }
        })
        .then(() => dashboardPage.startDeployment())
        .then(() => {deploymentDate = historyPointText + moment().format('HH:mm DD/MM/YYYY');})
        .assertElementsAppear(progressSelector, 10000, 'Deployment is started')
        .assertElementDisappears(progressSelector, 45000, 'Deployment is finished')
        .then(() => clusterPage.goToTab('History'))
        .assertElementsExist(historyPointSelector, 2, '2 points of "history line" are observed')
        .assertElementsExist(activeHistoryPoint, 1,
          'First point of "history line" is observed and still selected after second deployment')
        .assertElementsExist(inactiveHistoryPoint, 1,
          'Second point of "history line" is observed and not selected after second deployment')
        .findByCssSelector(activeHistoryPoint)
          .getVisibleText()
          .then((actualText) => assert.equal(actualText, currentDate,
            'First "History point" has correct description, time and date after second deployment'))
          .end()
        .findByCssSelector(inactiveHistoryPoint)
          .getVisibleText()
          .then((actualText) => assert.equal(actualText, deploymentDate,
            'Second "History point" has correct description, time and date after deployment'))
          .end()
        .assertElementsExist(nodeNameLink, 1, 'Only 1 node is observed after first deployment')
        .clickByCssSelector(inactiveHistoryPoint)
        .sleep(1000)
        .assertElementsExist(nodeNameLink, 2, '2 nodes are observed after second deployment')
        // Check "Deployment History" timeline visual design for different states
        .then(() => genericLib.moveCursorTo(historyTitleSelector))
        .then(() => genericLib.checkSelectorColors('Inactive and unhovered first "History point" ',
          inactiveHistoryPoint + ':not(:hover)', lgreyColor, lblueColor, lblueColor))
        .then(() => genericLib.moveCursorTo(inactiveHistoryPoint))
        .then(() => genericLib.checkSelectorColors('Inactive and hovered first "History point"',
          inactiveHistoryPoint + ':hover', greyColor, blueColor, blueColor))
        .then(() => genericLib.checkSelectorColors('Active and unhovered second "History point"',
          activeHistoryPoint + ':not(:hover)', lgreenColor, dblueColor, dblueColor))
        .then(() => genericLib.moveCursorTo(activeHistoryPoint))
        .then(() => genericLib.checkSelectorColors('Active and hovered second "History point"',
          activeHistoryPoint + ':hover', greenColor, blueColor, blueColor));
    },
    'Check that "Deployment History" results are saved'() {
      this.timeout = 45000;
      var activeHistoryPoint = historyPointSelector + '.active';
      var tabNames = ['Dashboard', 'Nodes', 'Networks', 'Settings', 'Logs', 'Workflows',
        'Health Check'];
      var chain = this.remote;
      // Check that "Deployment History" results saved after refreshing of page
      chain = chain.then(() => clusterPage.goToTab('History'))
      .waitForCssSelector(historyPointSelector, 5000)
      .clickByCssSelector(historyPointSelector)
      .then(() => command.refresh())
      .waitForCssSelector(activeHistoryPoint, 5000)
      .assertElementTextEquals(activeHistoryPoint, currentDate,
        'First "History point" still selected after refreshing of page');
      // Check that "Deployment History" results saved after switching between cluster tabs
      for (let i = 0; i < tabNames.length; i++) {
        chain = chain.findByCssSelector('.cluster-page .tabs')
          .clickLinkByText(tabNames[i])
          .end()
        .then(pollUntil((text) => window.$('.cluster-tab.active').text() === text || null,
          [tabNames[i]], 3000))
        .findByCssSelector('.cluster-page .tabs')
          .clickLinkByText('History')
          .end()
        .then(pollUntil((text) => window.$('.cluster-tab.active').text() === text || null,
          ['History'], 3000))
        .waitForCssSelector(activeHistoryPoint, 3000)
        .assertElementTextEquals(activeHistoryPoint, currentDate,
          'First "History point" still selected after swithing to "' + tabNames[i] + '" tab');
      }
      // Check that "Deployment History" results are not saved after switching to other page
      chain = chain.then(() => genericLib.gotoPage('Equipment'))
      .then(() => genericLib.gotoPage('Environments'))
      .then(() => clustersPage.goToEnvironment(clusterName))
      .then(() => clusterPage.goToTab('History'))
      .waitForCssSelector(activeHistoryPoint, 5000)
      .assertElementNotContainsText(activeHistoryPoint, currentDate,
        'First "History point" still selected after refreshing of page');
      return chain;
    },
    'Check that "History timeline" progress indicator is worked'() {
      this.timeout = 75000;
      var currentTimeMarkerPosition;
      var timeMarkerSelector = timelinePaneSelector + 'div.current-time-marker';
      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementAppears(showDetailsSelector, 10000,
          'Deployment is started and "Show Details" button is shown')
        .clickByCssSelector(showDetailsSelector)
        .assertElementsAppear(timelinePaneSelector, 5000, 'Deployment history timeline appears')
        .clickByCssSelector(tableViewButton)
        .assertElementsAppear(tablePaneSelector, 5000, '"Table pane" appears')
        .clickByCssSelector(timelineViewButton)
        .assertElementsAppear(timelinePaneSelector, 5000, '"Timeline pane" appears')
        .assertElementsExist(nodeNameLink, 3, '3 slave nodes are shown')
        .assertElementsAppear(nodeTaskItem, 20000, 'Deployment tasks appear on the timeline')
        .assertElementAppears(timeMarkerSelector, 5000, 'Time marker appears on the timeline')
        .findByCssSelector(timeMarkerSelector)
          .getComputedStyle('left')
          .then((value) => {currentTimeMarkerPosition = parseInt(value.split(' ')[0], 10);})
          .end()
        .then(pollUntil(() =>
          window.$('.deployment-timeline .timelines .node-task').length >= 8 || null, 60000))
        .findByCssSelector(timeMarkerSelector)
          .getComputedStyle('left')
          .then((value) => {
            return assert.isTrue(parseInt(value.split(' ')[0], 10) > currentTimeMarkerPosition,
              'Current time marker is moving showing tasks progress');
          })
          .end()
        .assertElementDisappears(progressSelector, 30000, 'Deployment is finished');
    },
    'Check that "Previous Deployments" dropdown is worked'() {
      this.timeout = 260000;
      var lastHistoryPoint = historyPointSelector + ':last-child';
      var buttonPreviousDeployments = historyTabSelector + 'button.dropdown-toggle';
      var dropdownMenuSelector = 'ul.dropdown-menu ';
      var menuItemSelector = dropdownMenuSelector + 'li';
      var lastItemSelector = menuItemSelector + ':last-child a.ready';
      return this.remote
        // Precondition
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementsAppear(progressSelector, 10000, 'Deployment is started')
        .assertElementDisappears(progressSelector, 45000, 'Deployment is finished')
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementsAppear(progressSelector, 10000, 'Deployment is started')
        .assertElementDisappears(progressSelector, 45000, 'Deployment is finished')
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementsAppear(progressSelector, 10000, 'Deployment is started')
        .assertElementDisappears(progressSelector, 45000, 'Deployment is finished')
        .then(() => nodesLib.removeNodeFromCluster())
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementsAppear(progressSelector, 10000, 'Deployment is started')
        .assertElementDisappears(progressSelector, 45000, 'Deployment is finished')
        .then(() => nodesLib.removeNodeFromCluster())
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())
        .assertElementsAppear(progressSelector, 10000, 'Deployment is started')
        .assertElementDisappears(progressSelector, 45000, 'Deployment is finished')
        .then(() => clusterPage.goToTab('History'))
        // Restore "Previous Deployments" default state
        .assertElementsAppear(lastHistoryPoint, 3000, 'Last "History point" appears')
        .clickByCssSelector(lastHistoryPoint)
        .assertElementsAppear(lastHistoryPoint + '.active', 1000, 'Last "History point" is active')
        // Check "Previous Deployments"
        .assertElementsAppear(buttonPreviousDeployments, 1000, '"Previous Deployments" btn appears')
        .assertElementTextEquals(buttonPreviousDeployments, 'Previous Deployments',
          '"Previous Deployments" button has correct title and dropdown toggle on it')
        .clickByCssSelector(buttonPreviousDeployments)
        .assertElementsAppear(dropdownMenuSelector, 1000, '"Previous Deployments" menu appears')
        .assertElementsExist(menuItemSelector, 2, '2 menu items are observed after few deployments')
        .assertElementTextEquals(lastItemSelector,
          currentDate.split('\n')[0] + currentDate.split('\n')[1],
          'Menu item has correct description, time and date of first deployment')
        .clickByCssSelector(lastItemSelector)
        .waitForElementDeletion(dropdownMenuSelector, 1000)
        .sleep(500)
        .assertElementTextEquals(buttonPreviousDeployments + '.ready.active', currentDate,
          'First "History point" has correct description, time and date after few deployments')
        .waitForCssSelector(nodeNameLink, 5000)
        .assertElementsExist(nodeNameLink, 1, 'Only 1 node is observed after first deployment')
        .clickByCssSelector(buttonPreviousDeployments)
        .assertElementsAppear(dropdownMenuSelector, 1000, '"Previous Deployments" menu appears')
        .assertElementsExist(menuItemSelector, 1,
          'Only 1 menu item is observed after one of "Previous Deployments" is selected')
        .pressKeys('\uE00C');
    },
    'Check "History" tab after environment reset'() {
      this.timeout = 45000;
      var firstHistoryPoint = historyTabSelector + 'button.dropdown-toggle.ready.active';
      return this.remote
        .assertElementsExist(historyPointSelector, 6,
          '6 "History points" are observed before environment reset')
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => clusterPage.goToTab('History'))
        .assertElementsAppear(firstHistoryPoint, 3000, 'First "History point" appears')
        .assertElementTextEquals(firstHistoryPoint, currentDate,
          'First "History point" has correct description, time and date after environment reset')
        .assertElementsExist(historyPointSelector, 6,
          '6 "History points" are observed after environment reset');
    },
    'Check that "Timeline View" is worked'() {
      this.timeout = 60000;
      var nodeNameSelector = 'div.nodes-group div.node div.name';
      var nodeNameColumn = timelinePaneSelector + 'div.node-names-column ';
      var timelineColumn = timelinePaneSelector + 'div.timelines-column ';
      var masterNodeSelector = nodeNameColumn + 'div.node-names div[style^="height"]:first-child';
      return this.remote
        .then(() => clusterPage.removeCluster(clusterName))
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .findByCssSelector(nodeNameSelector)
          .getVisibleText()
          .then((nodeName) => {controllerName = nodeName;})
          .end()
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => {
          if (parseInt(moment().format('ss'), 10) >= 50) {
            return this.remote.sleep(10000);
          } else {
            return false;
          }
        })
        .then(() => dashboardPage.startDeployment())
        .then(() => {currentTime = moment().format('HH:mm');})
        .then(() => {currentDate = moment().format(' DD/MM/YYYY');})
        .then(() => clusterPage.goToTab('History'))
        .assertElementDisappears(historyAlertSelector, 45000, 'Deployment is successful')
        // Check "Timeline View"
        .assertElementsAppear(timelinePaneSelector, 5000, '"Timeline pane" appears')
        .assertElementExists(nodeNameColumn, 'Node names column exists')
        .assertElementsExist(masterNodeSelector, 1, 'Master node exists')
        .assertElementTextEquals(masterNodeSelector, 'Master node', 'Master node has correct name')
        .assertElementsExist(nodeNameLink, 1, '1 controller node exists')
        .findByCssSelector(nodeNameLink)
          .getVisibleText()
          .then((nodeName) => assert.equal(nodeName, controllerName, 'Controller has correct name'))
          .end()
        .assertElementExists(timelineColumn, 'Timeline column exists')
        .assertElementsExist(nodeTaskItem, 7, '7 node tasks are observed')
        // Check popups
        .then(() => genericLib.moveCursorTo(nodeTaskItem + ':first-child'))
        .assertElementsAppear(taskPopover, 3000, 'Node task popover appears')
        .assertElementContainsText(popoverTaskName, 'Name', 'Task "Name" field is observed')
        .assertElementContainsText(popoverStatus, 'Status', 'Task "Status" field is observed')
        .assertElementContainsText(popoverStartTime, 'Started', 'Task "Started" field is observed')
        .assertElementContainsText(popoverEndTime, 'Finished', 'Task "Finished" field is observed')
        .then(() => genericLib.moveCursorTo(historyPointSelector))
        .assertElementDisappears(taskPopover, 3000, 'Node task popover disappears');
    },
    'Check that "Table View" is worked'() {
      var tableHeader = tablePaneSelector + 'thead th';
      return this.remote
        // Check that deploy start date/time the same as real
        .then(() => genericLib.moveCursorTo(nodeTaskItem + ':first-child'))
        .assertElementsAppear(taskPopover, 3000, 'Node task popover appears')
        .assertElementContainsText(popoverStartTime + 'span:last-child', currentTime,
          'Task start time the same as real via "Timeline View"')
        .assertElementContainsText(popoverStartTime + 'span:last-child', currentDate,
          'Task start date the same as real via "Timeline View"')
        // Check "Table View"
        .clickByCssSelector(tableViewButton)
        .assertElementsAppear(tablePaneSelector, 5000, '"Table pane" appears')
        .assertElementsExist(tableHeader, 6, '6 columns are observed by default')
        .assertElementTextEquals(tableHeader + ':nth-child(1)', 'Task', 'Column has true name')
        .assertElementTextEquals(tableHeader + ':nth-child(2)', 'Node', 'Column has true name')
        .assertElementTextEquals(tableHeader + ':nth-child(3)', 'Status', 'Column has true name')
        .assertElementTextEquals(tableHeader + ':nth-child(4)', 'Started', 'Column has true name')
        .assertElementTextEquals(tableHeader + ':nth-child(5)', 'Finished', 'Column has true name')
        .assertElementTextEquals(tableHeader + ':nth-child(6)', '', 'Column has true name')
        .assertElementsExist(tableBodyRow, 7, '7 node tasks are observed')
        .assertElementsExist(tableBodyRow + ' td', 42, '42 cells are observed in the table')
        .assertElementTextEquals(tableBodyRow + ' td:nth-child(2)', 'Master node',
          'Master node has correct name')
        .assertElementTextEquals(tableBodyRow + ':nth-child(2) td:nth-child(2)', controllerName,
          'Controller node has correct name')
        .assertElementContainsText(tableBodyRow + ' td:nth-child(4)', currentTime,
          'Task start time the same as real via "Table View"')
        .assertElementContainsText(tableBodyRow + ' td:nth-child(4)', currentDate,
          'Task start date the same as real via "Table View"')
        .clickByCssSelector(timelineViewButton)
        .assertElementsAppear(timelinePaneSelector, 5000, '"Timeline pane" appears');
    },
    'Check that "Timeline View" data equals to "Table View" data'() {
      this.timeout = 60000;
      return this.remote
        .then(() => historyLib.compareViewsData(2, controllerName))
        .then(() => historyLib.compareViewsData(3, controllerName))
        .then(() => historyLib.compareViewsData(4, controllerName))
        .then(() => historyLib.compareViewsData(5, controllerName))
        .then(() => historyLib.compareViewsData(6, controllerName))
        .then(() => historyLib.compareViewsData(7, controllerName));
    },
    'Check "History" tab support filtering'() {
      var filtersPaneSelector = 'div.filters ';
      var taskNameButton = filtersPaneSelector + 'div.filter-by-task_name button';
      var nodeNameButton = filtersPaneSelector + 'div.filter-by-node_id button';
      var taskStatusButton = filtersPaneSelector + 'div.filter-by-status button';
      var filterPopover = 'div.popover div.popover-content ';
      var resetFilter = filtersPaneSelector + 'button.btn-reset-filters';
      return this.remote
        .clickByCssSelector(tableViewButton)
        .assertElementsAppear(tablePaneSelector, 5000, '"Table pane" appears')
        .assertElementsExist(tableBodyRow, 7, '7 node tasks are observed before filtering')
        .clickByCssSelector(filterTasksButton)
        .assertElementsAppear(filtersPaneSelector, 5000, '"Filter pane" appears')
        .clickByCssSelector(taskNameButton)
        .assertElementsAppear(filterPopover, 3000, '"Filter popover" for task name appears')
        .clickByCssSelector(filterPopover + 'input[name="upload_configuration"]')
        .assertElementsExist(tableBodyRow, 2, '2 node tasks are observed after task name filter')
        .clickByCssSelector(taskStatusButton)
        .assertElementsAppear(filterPopover, 3000, '"Filter popover" for task status appears')
        .clickByCssSelector(filterPopover + 'input[name="ready"]')
        .assertElementsExist(tableBodyRow, 2, '2 node tasks are observed after task status filter')
        .clickByCssSelector(nodeNameButton)
        .assertElementsAppear(filterPopover, 3000, '"Filter popover" for node name appears')
        .clickByCssSelector(filterPopover + 'input[name="master"]')
        .assertElementsExist(tableBodyRow, 1, '1 node task is observed after node name filter')
        .assertElementTextEquals(tableBodyRow + ' td:nth-child(1)', 'upload_configuration',
          'Task name has correct filtered value')
        .assertElementTextEquals(tableBodyRow + ' td:nth-child(2)', 'Master node',
          'Node name has correct filtered value')
        .assertElementTextEquals(tableBodyRow + ' td:nth-child(3)', 'ready',
          'Task status has correct filtered value')
        .assertElementEnabled(resetFilter, '"Reset" button is available')
        .clickByCssSelector(resetFilter)
        .sleep(1000)
        .assertElementsExist(tableBodyRow, 7, '7 node tasks are observed after filter resetting');
    }
  };
});
