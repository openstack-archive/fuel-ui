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
    clusterName, firstDeployDate, controllerName;
  var nodeName = 'div.nodes-group div.node div.name';
  var progress = 'div.dashboard-tab div.progress';
  var showDetails = 'div.toggle-history button';

  var historyTab = 'div.history-tab ';
  var historyTitle = historyTab + 'div.title';
  var historyAlert = historyTab + 'div.alert';
  var historyLine = historyTab + 'div.transaction-list ';
  var historyPoint = historyLine + 'a.transaction-link.ready';
  var historyPointText = 'Deployment\n';
  var historyToolbar = 'div.deployment-history-toolbar ';
  var timelineViewButton = historyToolbar + 'label.timeline-view';
  var tableViewButton = historyToolbar + 'label.table-view';
  var filterTasksButton = historyToolbar + 'button.btn-filters';
  var exportCSVButton = historyToolbar + 'button.btn-export-history-csv';
  var zoomInButton = historyToolbar + 'button.btn-zoom-in';
  var zoomOutButton = historyToolbar + 'button.btn-zoom-out';

  var timelinePane = 'div.deployment-timeline ';
  var nodeNameLink = timelinePane + 'div.node-names button.btn-link';
  var nodeTaskItem = timelinePane + 'div.timelines div.node-task';
  var taskPopover = 'div.popover.deployment-task-info div.popover-content ';
  var popoverTaskName = taskPopover + 'div.task_name ';
  var popoverStatus = taskPopover + 'div.status ';
  var popoverStartTime = taskPopover + 'div.time_start ';
  var popoverEndTime = taskPopover + 'div.time_end ';
  var tablePane = 'div.history-table table ';
  var tableBodyRow = tablePane + 'tbody tr';

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
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .findByCssSelector(nodeName)
          .getVisibleText()
          .then((nodeName) => {controllerName = nodeName;})
          .end();
    },
    'Check "History" tab before deployment'() {
      return this.remote
        .then(() => clusterPage.goToTab('History'))

        .assertElementAppears(historyTab, 5000, '"History" tab appears')
        .assertElementExists(historyTitle, '"Deployment History" title exists')

        .assertElementMatchesRegExp(historyTitle, /Deployment History/i,
                                    '"Deployment History" title has correct description')

        .assertElementExists(historyAlert, 'Alert message exists')
        .assertElementMatchesRegExp(historyAlert, /No deployment finished yet./i,
                                    'Alert message is correct');
    },
    'Check "History" tab after first deployment'() {
      this.timeout = 70000;

      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))

        .then(() => historyLib.waitForZeroSeconds())
        .then(() => dashboardPage.startDeployment())
        .then(() => {firstDeployDate = moment().format('HH:mm DD/MM/YYYY');})

        .then(() => clusterPage.goToTab('History'))

        .assertElementDisappears(historyAlert, 45000, 'Deployment is successful')
        .assertElementExists(historyTitle, '"Deployment History" title exists')
        .assertElementMatchesRegExp(historyTitle, /Deployment History/i,
                                    '"Deployment History" title has correct description')
        .assertElementExists(historyLine, '"History line" pane exists')
        .assertElementsExist(historyPoint + '.active', 1, 'Only 1 point of "history line" is ' +
                             'observed and selected after deployment')

        .findByCssSelector(historyPoint)
          .getVisibleText()
          .then((actualText) => assert.equal(actualText, historyPointText + firstDeployDate,
            '"History point" has correct description, time and date'))
          .end()

        .assertElementEnabled(timelineViewButton + '.active',
                              '"Timeline View" button exists and active')
        .assertElementEnabled(tableViewButton + ':not(.active)',
                              '"Table View" button exists and not active')

        .assertElementExists(exportCSVButton + ':enabled', '"Export CSV" button exists and enabled')
        .assertElementExists(zoomInButton + ':disabled', '"Zoom In" button exists and disabled')
        .assertElementExists(zoomOutButton + ':disabled', '"Zoom Out" button exists and disabled')
        .assertElementExists(timelinePane, '"Timeline pane" exists and opened by default')

        // Check that user can switch between "Timeline View" and "Table View"
        .clickByCssSelector(tableViewButton)
        .assertElementsAppear(tablePane, 5000, '"Table pane" appears')
        .assertElementEnabled(timelineViewButton + ':not(.active)',
                              '"Timeline View" button exists and not active')
        .assertElementEnabled(tableViewButton + '.active', '"Table View" button exists and active')

        .assertElementExists(filterTasksButton + ':enabled',
                             '"Filter Tasks" button exists and enabled')
        .assertElementExists(exportCSVButton + ':enabled', '"Export CSV" button exists and enabled')

        .clickByCssSelector(timelineViewButton)
        .assertElementsAppear(timelinePane, 5000, '"Timeline pane" appears');
    },
    'Check that "History timeline" progress indicator is worked'() {
      this.timeout = 75000;

      var currentTimeMarkerPosition;
      var timeMarker = timelinePane + 'div.current-time-marker';

      return this.remote
        .then(() => common.addNodesToCluster(1, ['Controller']))

        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardPage.startDeployment())

        .assertElementAppears(showDetails, 10000,
                              'Deployment is started and "Show Details" button is shown')
        .clickByCssSelector(showDetails)
        .assertElementsAppear(timelinePane, 5000, 'Deployment history timeline appears')

        .clickByCssSelector(tableViewButton)
        .assertElementsAppear(tablePane, 5000, '"Table pane" appears')
        .clickByCssSelector(timelineViewButton)
        .assertElementsAppear(timelinePane, 5000, '"Timeline pane" appears')

        .assertElementsExist(nodeNameLink, 2, '2 slave nodes are shown')
        .assertElementsAppear(nodeTaskItem, 20000, 'Deployment tasks appear on the timeline')
        .assertElementAppears(timeMarker, 5000, 'Time marker appears on the timeline')

        .findByCssSelector(timeMarker)
          .getComputedStyle('left')
          .then((value) => {currentTimeMarkerPosition = parseInt(value.split(' ')[0], 10);})
          .end()

        .then(pollUntil(() =>
          window.$('.deployment-timeline .timelines .node-task').length >= 6 || null, 60000))

        .findByCssSelector(timeMarker)
          .getComputedStyle('left')
          .then((value) => {
            return assert.isTrue(parseInt(value.split(' ')[0], 10) > currentTimeMarkerPosition,
                                 'Current time marker is moving showing tasks progress');
          })
          .end()

        .assertElementDisappears(progress, 30000, 'Deployment is finished');
    },
    'Check "History" tab after third cluster deployment'() {
      this.timeout = 80000;

      var thirdDeployDate;
      var activeHistoryPoint = historyPoint + '.active';
      var inactiveHistoryPoint = historyPoint + ':not(.active)';
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
        .then(() => historyLib.waitForZeroSeconds())
        .then(() => dashboardPage.startDeployment())

        .then(() => {thirdDeployDate = moment().format('HH:mm DD/MM/YYYY');})
        .assertElementsAppear(progress, 10000, 'Deployment is started')
        .assertElementDisappears(progress, 45000, 'Deployment is finished')

        .then(() => clusterPage.goToTab('History'))

        .assertElementsExist(historyPoint, 3, '3 points of "history line" are observed')
        .assertElementsExist(activeHistoryPoint, 1, 'First point of "history line" is observed ' +
                             'and still selected after third deployment')
        .assertElementsExist(inactiveHistoryPoint, 2, '2 points of "history line" are observed ' +
                             'and not selected after third deployment')

        .assertElementTextEquals(activeHistoryPoint, historyPointText + firstDeployDate,
                                 'First "History point" has correct description, time and date ' +
                                 'after third deployment')

        .findByCssSelector(inactiveHistoryPoint + ':last-child')
          .getVisibleText()
          .then((actualText) => assert.equal(actualText, historyPointText + thirdDeployDate,
                                             'Third "History point" has correct description, ' +
                                             'time and date after deployment'))
          .end()

        .assertElementsExist(nodeNameLink, 1, 'Only 1 node is observed after first deployment')

        .clickByCssSelector(inactiveHistoryPoint + ':last-child')
        .assertElementsAppear(timelinePane, 5000, '"Timeline pane" appears')
        .assertElementsAppear(activeHistoryPoint + ':last-child', 5000,
                              'Thirs "History point" is switched to active state')
        .assertElementsExist(nodeNameLink, 3, '3 nodes are observed after third deployment')

        // Check "Deployment History" timeline visual design for different states
        .then(() => genericLib.moveCursorTo(historyTitle)).sleep(500)
        .then(() => genericLib.checkSelectorColors('Inactive and unhovered first "History point" ',
                                           inactiveHistoryPoint + ':not(:hover)',
                                           lgreyColor, lblueColor, lblueColor))

        .then(() => genericLib.moveCursorTo(inactiveHistoryPoint))
        .then(() => genericLib.checkSelectorColors('Inactive and hovered first "History point"',
                                           inactiveHistoryPoint + ':hover',
                                           greyColor, blueColor, blueColor))

        .then(() => genericLib.moveCursorTo(historyTitle)).sleep(500)
        .then(() => genericLib.checkSelectorColors('Active and unhovered third "History point"',
                                           activeHistoryPoint + ':not(:hover)',
                                           lgreenColor, lblueColor, dblueColor))

        .then(() => genericLib.moveCursorTo(activeHistoryPoint))
        .then(() => genericLib.checkSelectorColors('Active and hovered third "History point"',
                                           activeHistoryPoint + ':hover',
                                           greenColor, blueColor, blueColor));
    },
    'Check that "Deployment History" results are saved'() {
      this.timeout = 60000;

      var activeHistoryPoint = historyPoint + '.active';
      var tabNames = ['Dashboard', 'Nodes', 'Networks', 'Settings', 'Logs', 'Workflows',
                      'Health Check'];

      var chain = this.remote;
      chain = chain.then(() => clusterPage.goToTab('History'))

      .assertElementsAppear(timelinePane, 5000, '"Timeline pane" appears')
      .clickByCssSelector(historyPoint);

      // Check that "Deployment History" results saved after refreshing of page
//      chain = chain.then(() => command.refresh())
//      .waitForCssSelector(activeHistoryPoint, 5000)
//      .assertElementTextEquals(activeHistoryPoint, historyPointText + firstDeployDate,
//                              'First "History point" still selected after refreshing of page');

      // Check that "Deployment History" results saved after switching between cluster tabs
//      for (let i = 0; i < tabNames.length; i++) {
//        chain = chain.findByCssSelector('.cluster-page .tabs')
//          .clickLinkByText(tabNames[i])
//          .end()
//        .then(pollUntil((text) => window.$('.cluster-tab.active').text() === text || null,
//                        [tabNames[i]], 3000))
//
//        .findByCssSelector('.cluster-page .tabs')
//          .clickLinkByText('History')
//          .end()
//        .then(pollUntil((text) => window.$('.cluster-tab.active').text() === text || null,
//                        ['History'], 3000))
//
//        .waitForCssSelector(activeHistoryPoint, 3000)
//        .assertElementTextEquals(activeHistoryPoint, historyPointText + firstDeployDate,
//                                 'First "History point" still selected after swithing to "' +
//                                 tabNames[i] + '" tab');
//      }

      // Check that "Deployment History" results are not saved after switching to other page
      chain = chain.then(() => genericLib.gotoPage('Equipment'))

      .then(() => genericLib.gotoPage('Environments'))
      .then(() => clustersPage.goToEnvironment(clusterName))

      .then(() => clusterPage.goToTab('History'))
//      .assertElementsAppear(activeHistoryPoint + ':last-child', 5000, 'Last "History point" is ' +
//                            'switched to active state after switching to other page')
//      .assertElementNotContainsText(activeHistoryPoint, historyPointText + firstDeployDate,
//                                    'First "History point" is not selected after switching to ' +
//                                    'other page');
      return chain;
    },
    'Check that "Timeline View" is worked'() {
      this.timeout = 60000;

      var nodeNameColumn = timelinePane + 'div.node-names-column ';
      var timelineColumn = timelinePane + 'div.timelines-column ';
      var masterNode = nodeNameColumn + 'div.node-names div[style^="height"]:first-child';

      return this.remote
        // Check "Timeline View"
        .then(() => clusterPage.goToTab('History'))
        .assertElementsAppear(timelinePane, 5000, '"Timeline pane" appears')
        .waitForCssSelector(historyPoint, 3000)

        .clickByCssSelector(historyPoint)
//        .assertElementExists(nodeNameColumn, 'Node names column exists')
//        .assertElementsExist(masterNode, 1, 'Master node exists')
//        .assertElementTextEquals(masterNode, 'Master node', 'Master node has correct name')
//
//        .assertElementsExist(nodeNameLink, 1, '1 controller node exists')
//        .assertElementTextEquals(nodeNameLink, controllerName, 'Controller has correct name')
//        .assertElementExists(timelineColumn, 'Timeline column exists')
//        .assertElementsExist(nodeTaskItem, 8, '8 node tasks are observed')

        // Check popups
        .then(() => genericLib.moveCursorTo(nodeTaskItem + ':first-child'))
//        .assertElementsAppear(taskPopover, 3000, 'Node task popover appears')
//        .assertElementContainsText(popoverTaskName, 'Name', 'Task "Name" field is observed')
//        .assertElementContainsText(popoverStatus, 'Status', 'Task "Status" field is observed')
//        .assertElementContainsText(popoverStartTime, 'Started', 'Task "Started" field is observed')
//        .assertElementContainsText(popoverEndTime, 'Finished', 'Task "Finished" field is observed')

        .then(() => genericLib.moveCursorTo(historyPoint))
//        .assertElementDisappears(taskPopover, 3000, 'Node task popover disappears');
    },
    'Check that "Table View" is worked'() {
      var currentTime = firstDeployDate.split(' ')[0];
      var currentDate = firstDeployDate.split(' ')[1];
      var tableHeader = tablePane + 'thead th';

      return this.remote
        // Check that deploy start date/time the same as real
        .then(() => genericLib.moveCursorTo(nodeTaskItem + ':first-child'))
//        .assertElementsAppear(taskPopover, 3000, 'Node task popover appears')
//        .assertElementContainsText(popoverStartTime + 'span:last-child', currentTime,
//                                   'Task start time the same as real via "Timeline View"')
//        .assertElementContainsText(popoverStartTime + 'span:last-child', currentDate,
//                                   'Task start date the same as real via "Timeline View"')

        // Check "Table View"
        .clickByCssSelector(tableViewButton)
//        .assertElementsAppear(tablePane, 5000, '"Table pane" appears')
//        .assertElementsExist(tableHeader, 7, '7 columns are observed by default')
//        .assertElementTextEquals(tableHeader + ':nth-child(1)', 'Task', 'Column has true name')
//        .assertElementTextEquals(tableHeader + ':nth-child(2)', 'Node', 'Column has true name')
//        .assertElementTextEquals(tableHeader + ':nth-child(3)', 'Status', 'Column has true name')
//        .assertElementTextEquals(tableHeader + ':nth-child(4)', 'Type', 'Column has true name')
//        .assertElementTextEquals(tableHeader + ':nth-child(5)', 'Started', 'Column has true name')
//        .assertElementTextEquals(tableHeader + ':nth-child(6)', 'Finished', 'Column has true name')
//        .assertElementTextEquals(tableHeader + ':nth-child(7)', '', 'Column has true name')
//
//        .assertElementsExist(tableBodyRow, 8, '8 node tasks are observed')
//        .assertElementsExist(tableBodyRow + ' td', 56, '56 cells are observed in the table')
//
//        .assertElementTextEquals(tableBodyRow + ' td:nth-child(2)', 'Master node',
//                                 'Master node has correct name')
//        .assertElementTextEquals(tableBodyRow + ':nth-child(2) td:nth-child(2)', controllerName,
//                                 'Controller node has correct name')
//
//        .assertElementContainsText(tableBodyRow + ' td:nth-child(5)', currentTime,
//                                   'Task start time the same as real via "Table View"')
//        .assertElementContainsText(tableBodyRow + ' td:nth-child(5)', currentDate,
//                                   'Task start date the same as real via "Table View"');
    },
    'Check that "Timeline View" data equals to "Table View" data'() {
      this.timeout = 60000;

      return this.remote
//        .then(() => historyLib.compareViewsData(2, 'Master Node'))

        .then(() => historyLib.compareViewsData(2, controllerName))
//        .then(() => historyLib.compareViewsData(3, controllerName))
//        .then(() => historyLib.compareViewsData(4, controllerName))
//        .then(() => historyLib.compareViewsData(5, controllerName))
//        .then(() => historyLib.compareViewsData(6, controllerName))
//        .then(() => historyLib.compareViewsData(7, controllerName))

//        .then(() => historyLib.compareViewsData(8, controllerName));
    },
//    'Check "History" tab support filtering'() {
//      var filtersPane = 'div.filters ';
//      var taskNameButton = filtersPane + 'div.filter-by-task_name button';
//      var nodeNameButton = filtersPane + 'div.filter-by-node_id button';
//      var taskStatusButton = filtersPane + 'div.filter-by-status button';
//      var filterPopover = 'div.popover div.popover-content ';
//      var resetFilter = filtersPane + 'button.btn-reset-filters';
//
//      return this.remote
//        .clickByCssSelector(tableViewButton)
//        .assertElementsAppear(tablePane, 5000, '"Table pane" appears')
//        .assertElementsExist(tableBodyRow, 8, '8 node tasks are observed before filtering')
//
//        .clickByCssSelector(filterTasksButton)
//        .assertElementsAppear(filtersPane, 5000, '"Filter pane" appears')
//
//        .clickByCssSelector(taskNameButton)
//        .assertElementsAppear(filterPopover, 3000, '"Filter popover" for task name appears')
//
//        .clickByCssSelector(filterPopover + 'input[name="upload_configuration"]')
//        .assertElementsExist(tableBodyRow, 2, '2 node tasks are observed after task name filter')
//
//        .clickByCssSelector(taskStatusButton)
//        .assertElementsAppear(filterPopover, 3000, '"Filter popover" for task status appears')
//
//        .clickByCssSelector(filterPopover + 'input[name="ready"]')
//        .assertElementsExist(tableBodyRow, 2, '2 node tasks are observed after task status filter')
//
//        .clickByCssSelector(nodeNameButton)
//        .assertElementsAppear(filterPopover, 3000, '"Filter popover" for node name appears')
//
//        .clickByCssSelector(filterPopover + 'input[name="master"]')
//        .assertElementsExist(tableBodyRow, 1, '1 node task is observed after node name filter')
//        .assertElementTextEquals(tableBodyRow + ' td:nth-child(1)', 'upload_configuration',
//                                 'Task name has correct filtered value')
//        .assertElementTextEquals(tableBodyRow + ' td:nth-child(2)', 'Master node',
//                                 'Node name has correct filtered value')
//        .assertElementTextEquals(tableBodyRow + ' td:nth-child(3)', 'Ready',
//                                 'Task status has correct filtered value')
//        .assertElementEnabled(resetFilter, '"Reset" button is available')
//
//        .clickByCssSelector(resetFilter).sleep(1000)
//        .assertElementsExist(tableBodyRow, 8, '8 node tasks are observed after filter resetting');
//    },
//    'Check that "Previous Deployments" dropdown is worked'() {
//      this.timeout = 300000;
//
//      var lastHistoryPoint = historyPoint + ':last-child';
//      var buttonPreviousDeployments = historyTab + 'button.dropdown-toggle';
//      var dropdownMenu = 'ul.dropdown-menu ';
//      var menuItem = dropdownMenu + 'li';
//      var lastItem = menuItem + ':last-child a.ready';
//
//      return this.remote
//        // Precondition
//        .then(() => common.addNodesToCluster(1, ['Controller']))
//                .then(() => clusterPage.goToTab('Dashboard'))
//        .then(() => dashboardPage.startDeployment())
//
//        .assertElementsAppear(progress, 10000, 'Deployment is started')
//        .assertElementDisappears(progress, 45000, 'Deployment is finished')
//
//        .then(() => common.addNodesToCluster(1, ['Controller']))
//        .then(() => clusterPage.goToTab('Dashboard'))
//        .then(() => dashboardPage.startDeployment())
//
//        .assertElementsAppear(progress, 10000, 'Deployment is started')
//        .assertElementDisappears(progress, 45000, 'Deployment is finished')
//
//        .then(() => common.addNodesToCluster(1, ['Controller']))
//        .then(() => clusterPage.goToTab('Dashboard'))
//        .then(() => dashboardPage.startDeployment())
//
//        .assertElementsAppear(progress, 10000, 'Deployment is started')
//        .assertElementDisappears(progress, 45000, 'Deployment is finished')
//
//        .then(() => nodesLib.removeNodeFromCluster())
//        .then(() => clusterPage.goToTab('Dashboard'))
//        .then(() => dashboardPage.startDeployment())
//
//        .assertElementsAppear(progress, 10000, 'Deployment is started')
//        .assertElementDisappears(progress, 45000, 'Deployment is finished')
//
//        .then(() => nodesLib.removeNodeFromCluster())
//        .then(() => clusterPage.goToTab('Dashboard'))
//        .then(() => dashboardPage.startDeployment())
//
//        .assertElementsAppear(progress, 10000, 'Deployment is started')
//        .assertElementDisappears(progress, 45000, 'Deployment is finished')
//
//        .then(() => clusterPage.goToTab('History'))
//
//        // Restore "Previous Deployments" default state
//        .assertElementsAppear(lastHistoryPoint, 3000, 'Last "History point" appears')
//        .clickByCssSelector(lastHistoryPoint)
//        .assertElementsAppear(lastHistoryPoint + '.active', 1000, 'Last "History point" is active')
//
//        // Check "Previous Deployments"
//        .assertElementsAppear(buttonPreviousDeployments, 1000, '"Previous Deployments" btn appears')
//        .assertElementTextEquals(buttonPreviousDeployments, 'Previous Deployments',
//                                 '"Previous Deployments" button has correct title and dropdown ' +
//                                 'toggle on it')
//
//        .clickByCssSelector(buttonPreviousDeployments)
//        .assertElementsAppear(dropdownMenu, 1000, '"Previous Deployments" menu appears')
//        .assertElementsExist(menuItem, 2, '2 menu items are observed after few deployments')
//        .assertElementTextEquals(lastItem, historyPointText.slice(0, -1) + firstDeployDate,
//                                 'Menu item has correct description, time and date of first ' +
//                                 'deployment')
//
//        .clickByCssSelector(lastItem)
//        .waitForElementDeletion(dropdownMenu, 1000).sleep(500)
//        .assertElementTextEquals(buttonPreviousDeployments + '.ready.active',
//                                 historyPointText + firstDeployDate, 'First "History point" has ' +
//                                 'correct description, time and date after few deployments')
//
//        .waitForCssSelector(nodeNameLink, 5000)
//        .assertElementsExist(nodeNameLink, 1, 'Only 1 node is observed after first deployment')
//
//        .clickByCssSelector(buttonPreviousDeployments)
//        .assertElementsAppear(dropdownMenu, 1000, '"Previous Deployments" menu appears')
//        .assertElementsExist(menuItem, 1, 'Only 1 menu item is observed after one of ' +
//                             '"Previous Deployments" is selected')
//        .pressKeys('\uE00C');
//    }
    /*
    FIXME: Uncomment after bugfix.
    Bug: https://bugs.launchpad.net/fuel/+bug/1618852

    'Check "History" tab after environment reset'() {
      this.timeout = 60000;
      var firstHistoryPoint = historyTab + 'button.dropdown-toggle.ready.active';
      return this.remote
        .assertElementsAppear(firstHistoryPoint, 3000, 'First "History point" appears')
        .assertElementTextEquals(firstHistoryPoint, historyPointText + firstDeployDate,
          'First "History point" has correct description, time and date before environment reset')
        .assertElementsExist(historyPoint, 6,
          '6 "History points" are observed before environment reset')
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => clusterPage.resetEnvironment(clusterName))
        .then(() => dashboardPage.discardChanges())
        .then(() => clusterPage.goToTab('History'))
        .assertElementAppears(historyTab, 5000, '"History" tab appears')
        .assertElementExists(historyTitle, '"Deployment History" title exists')
        .assertElementMatchesRegExp(historyTitle, /Deployment History/i,
          '"Deployment History" title has correct description')
        .assertElementExists(historyAlert, 'Alert message exists')
        .assertElementMatchesRegExp(historyAlert, /No deployment finished yet./i,
          'Alert message is correct.')
        .assertElementNotExists(historyPoint,
          'All history was removed after environment reset');
    }
    */
  };
});
