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
import Common from 'tests/functional/pages/common';
import ClusterPage from 'tests/functional/pages/cluster';
import DashboardPage from 'tests/functional/pages/dashboard';
import ModalWindow from 'tests/functional/pages/modal';
import DashboardLib from 'tests/functional/nightly/library/dashboard';

registerSuite(() => {
  var common, clusterPage, dashboardPage, dashboardLib, clusterName, modal;
  var controllerName = 'Supermicro X9DRW';
  var computeName = 'Dell Inspiron';
  var workflowName = 'epicBoost';
  var modalBody = 'div.modal-body';

  var workflowTab = 'div.workflows-tab ';
  var toolbar = workflowTab + 'div.deployment-graphs-toolbar ';
  var filterWorkflowsButton = toolbar + 'button.btn-filters';
  var uploadNewGraphButton = toolbar + 'button.btn-upload-graph';
  var workflowTable = workflowTab + 'table.workflows-table ';
  var tableBody = workflowTable + 'tbody ';
  var tableRow = tableBody + 'tr';
  var deleteGraphButton = 'button.btn-remove-graph';

  return {
    name: 'Workflows',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clusterName = common.pickRandomName('Workflow Cluster');
      dashboardPage = new DashboardPage(this.remote);
      dashboardLib = new DashboardLib(this.remote);
      modal = new ModalWindow(this.remote);

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']))
        .then(() => common.addNodesToCluster(1, ['Compute']));
    },
    beforeEach() {
      return this.remote
        .then(() => clusterPage.goToTab('Workflows'))
        .assertElementAppears(workflowTab, 5000, '"Workflows" tab appears');
    },
    'Check that default "Workflow" is not avaliable as deployment mode'() {
      var deployModeMenu = 'ul.dropdown-menu';

      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardLib.changeDeploymentMode('Workflow'))

        .assertElementNotDisplayed(deployModeMenu, 'Deployment Mode menu is not displayed')
        .catch((error) => {
          return this.remote
            .pressKeys('\uE00C')
            .assertElementNotDisplayed(deployModeMenu, 'Default "Workflow" is not ' +
                                       'avaliable at Deployment Mode menu. Check error message: ' +
                                       error);
        });
    },
    'Check that "Workflows" tab is worked'() {
      var workflowTitle = workflowTab + 'div.title';
      var tableHeader = workflowTable + 'thead';

      return this.remote
        .assertElementExists(workflowTitle, '"Workflows" title exists')
        .assertElementMatchesRegExp(workflowTitle, /Workflows/i,
                                    '"Workflows" title has correct description')

        .assertElementEnabled(filterWorkflowsButton, '"Filter Workflows" button exists')
        .assertElementEnabled(uploadNewGraphButton, '"Upload New Workflow" button exists')

        .assertElementExists(tableHeader, '"Workflows" table header exists')
        .assertElementMatchesRegExp(tableHeader, /Name Level Actions Download/i,
                                    '"Workflows" table header has correct description')
        .assertElementExists(tableBody, '"Workflows" table body exists')
        .assertElementsExist(tableRow, 3, 'Workflows table includes release- and ' +
                             'cluster-level default workflows')

        .assertElementContainsText(tableRow + ':first-child', 'Type "default"',
                                   'The first row is default resulting graph for the cluster')
        .assertElementContainsText(tableRow + ':nth-child(2)', 'Release',
                                   'The second row is "Release" level of graph for the cluster')
        .assertElementContainsText(tableRow + ':nth-child(3)', 'Environment',
                                   'The third row is "Environment" level of graph for the cluster')

        .assertElementNotExists(tableRow + ':first-child ' + deleteGraphButton,
                                'User can not delete resulting graph for the cluster')
        .assertElementExists(tableRow + ':last-child ' + deleteGraphButton,
                             'User can delete default cluster graph');
    },
    'Check "Workflows" tab support filtering'() {
      var filtersPane = toolbar + 'div.filters ';
      var graphTypeButton = filtersPane + 'div.filter-by-graph_type button';
      var graphLevelButton = filtersPane + 'div.filter-by-graph_level button';
      var filterPopover = toolbar + 'div.popover div.popover-content ';
      var resetFilter = filtersPane + 'button.btn-reset-filters';
      var alert = workflowTab + 'div.alert';

      return this.remote
        .assertElementAppears(filterWorkflowsButton + ':enabled', 1000,
                              'Enabled "Filter Workflows" button appears')

        .clickByCssSelector(filterWorkflowsButton)
        .assertElementAppears(filtersPane, 3000, '"Workflows" filter pane appears')
        .assertElementEnabled(graphTypeButton, 'Filter by "Type" button exists')
        .assertElementEnabled(graphLevelButton, 'Filter by "Level" button exists')
        .assertElementsExist(tableRow, 3, 'Table includes release- and cluster-level default ' +
                             'workflows before filtering')

        .clickByCssSelector(graphTypeButton)
        .assertElementsAppear(filterPopover, 3000, '"Filter popover" by "Type" appears')

        .clickByCssSelector(filterPopover + 'input[name="default"]')
        .assertElementsExist(tableRow, 3, 'Table includes release- and cluster-level default ' +
                             'workflows after filtering by "Type"')

        .clickByCssSelector(graphLevelButton)
        .assertElementsAppear(filterPopover, 3000, '"Filter popover" by "Level" appears')

        .clickByCssSelector(filterPopover + 'input[name="plugin"]')
        .assertElementDisappears(workflowTable, 3000, 'Workflows table doesn`t have plugin ' +
                                 'workflows, so workflows table disappears')
        .assertElementExists(alert, 'Warning message exists')
        .assertElementMatchesRegExp(alert, /No workflows matched applied filters./i,
                                    'Warning message has correct description')

        .clickByCssSelector(filterPopover + 'input[name="release"]')
        .assertElementsAppear(workflowTable, 3000, 'Workflows table appears')
        .assertElementsExist(tableRow, 2, 'Table includes release-level default workflow after ' +
                             'filtering by "Level"')
        .assertElementEnabled(resetFilter, '"Reset Filter" button exists')

        .clickByCssSelector(resetFilter)
        .assertElementDisappears(filterPopover, 3000, '"Filter popover" by "Level" disappears')
        .assertElementsExist(tableRow, 3, 'Table includes release- and cluster-level default ' +
                             'workflows after filter reset');
    },
    'Check that user can upload new custom Graph'() {
      var dialogUploadBody = 'div.upload-graph-form ';
      var dialogUploadError = dialogUploadBody + 'div.has-error span.help-block';

      return this.remote
        .assertElementAppears(uploadNewGraphButton + ':enabled', 1000,
                              'Enabled "Upload New Workflow" button appears')

        .clickByCssSelector(uploadNewGraphButton)
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Upload New Workflow'))
        .assertElementsExist(dialogUploadBody, 'Upload graph form is exist in the dialog window')

        .then(() => modal.clickFooterButton('Upload'))
        .assertElementExists(dialogUploadError, 'There is an error due to type field is empty')
        .assertElementMatchesRegExp(dialogUploadError, /Invalid type/i,
                                    'Error message has correct description')

        .setInputValue(dialogUploadBody + 'input[name="type"]', 'default')

        .then(() => modal.clickFooterButton('Upload'))
        .assertElementExists(dialogUploadError, 'There is an error due to this type already exists')
        .assertElementMatchesRegExp(dialogUploadError, /Workflow with this type already exists./i,
                                    'Error message has correct description')

        .setInputValue(dialogUploadBody + 'input[name=name]', workflowName)
        .setInputValue(dialogUploadBody + 'input[name=type]', workflowName)
        .assertElementDisappears(dialogUploadError, 1000, 'Error message disappears after set type')

        .then(() => modal.clickFooterButton('Upload'))
        .then(() => modal.waitToClose())
        .assertElementsExist(tableRow, 5, 'New graph successfully uploaded')
        .assertElementContainsText(tableRow + ':nth-child(4)', 'Type "' + workflowName + '"',
                                   'New graph includes resulting graph for just uploaded workflow')
        .assertElementContainsText(tableRow + ':nth-child(5)', 'Environment',
                                   'New graph includes cluster-level for just uploaded workflow');
    },
    'Check that custom Workflow can be executed'() {
      this.timeout = 75000;

      var progress = 'div.dashboard-tab div.progress';
      var workflowPane = 'div.actions-panel ';
      var customGraph = workflowPane + 'select[name="customGraph"]';
      var runWorkflowButton = workflowPane + 'button.btn-run-graph';

      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardLib.changeDeploymentMode('Workflow'))
        .assertElementAppears(customGraph, 3000, 'Custom workflow dropdown appears')
        .assertElementPropertyEquals(customGraph, 'value', workflowName, 'Custom workflow ' +
                                     'dropdown exists and shows just uploaded new graph')

        .clickByCssSelector(runWorkflowButton)
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Run Custom Workflow'))
        .assertElementContainsText(modalBody, 'Click Run Workflow to execute custom deployment ' +
                                   'tasks on the selected nodes.',
                                   'Confirmation message is correct')

        .then(() => modal.clickFooterButton('Run Workflow'))
        .assertElementDisappears('div.confirmation-question', 5000, 'Confirm dialog disappears')
        .assertElementAppears(modalBody, 1000, 'Error message appears')
        .assertElementContainsText(modalBody, 'Deployment tasks not found for', 'Workflow can ' +
                                   'not be started because it contains no deployment tasks')

        .then(() => modal.clickFooterButton('Close'))
        .then(() => modal.waitToClose())
        .then(() => dashboardLib.changeDeploymentMode('Deploy'))
        .then(() => dashboardPage.startDeployment())

        .assertElementsAppear(progress, 10000, 'Deployment is started')
        .assertElementDisappears(progress, 45000, 'Deployment is finished')

        .assertElementsAppear(workflowPane, 5000, 'Workflow panel is shown on Dashboard')
        .assertElementPropertyEquals(customGraph, 'value', workflowName,
                                     'Custom workflow dropdown is shown on the dashboard for ' +
                                     'the operational cluster')
        .assertElementContainsText(runWorkflowButton, 'Run Workflow on 2 Nodes',
                                   'User can run custom graph for operational cluster');
    },
    'Check "Workflows" nodes selection dialog supports Quick Search, Sorting and Filtering'() {
      this.timeout = 45000;

      var deepCheck = [controllerName, computeName, ['input[name="error"]']];

      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardLib.selectNodes('Custom Workflow', 1, 1, 1, 0, deepCheck));
    },
    'Check that user can delete Workflow'() {
      var tableRowLast = tableRow + ':last-child ';
      var confirmationForm = 'div.confirmation-form ';
      var deleteWorkflow = 'div.modal-footer button.remove-graph-btn';

      return this.remote
        .assertElementAppears(tableRowLast + deleteGraphButton, 1000,
                              'User can delete cluster graph')

        .clickByCssSelector(tableRowLast + deleteGraphButton)
        .then(() => modal.waitToOpen())

        .then(() => modal.checkTitle('Delete Workflow'))
        .assertElementExists(modalBody, 'Warning message is shown')
        .assertElementContainsText(modalBody, 'Important' + 'Are you sure you want to delete ' +
                                   'this workflow?', 'Warning message is correct')

        .then(() => modal.clickFooterButton('Delete'))
        .assertElementAppears(confirmationForm, 1000, 'Confirmation form for graph removing appers')
        .assertElementDisabled(deleteWorkflow, 'Delete button is disabled, until requested ' +
                               'confirmation text will be entered')

        .setInputValue(confirmationForm + 'input', workflowName)
        .assertElementEnabled(deleteWorkflow, 'Delete button is enabled after requested ' +
                              'confirmation text entered')

        .then(() => modal.clickFooterButton('Delete'))
        .then(() => modal.waitToClose())
        .assertElementNotContainsText(tableRowLast, workflowName,
          'The graph was successfully deleted');
    }
  };
});
