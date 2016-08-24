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
  var common, clusterPage, dashboardPage, clusterName, modal, dashboardLib;
  var workflowName = 'epicBoost';
  var workflowTableSelector = '.workflows-table ';
  var tableRowSelector = workflowTableSelector + 'tbody tr';

  return {
    name: 'Workflows',
    setup() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      clusterName = common.pickRandomName('Workflow Cluster');
      dashboardPage = new DashboardPage(this.remote);
      modal = new ModalWindow(this.remote);
      dashboardLib = new DashboardLib(this.remote);

      return this.remote
        .then(() => common.getIn())
        .then(() => common.createCluster(clusterName))
        .then(() => common.addNodesToCluster(1, ['Controller']));
    },
    'Check that default Workflow is not avaliable as deployment mode'() {
      var dropdownPaneSelector = '.actions-panel .dropdown ';
      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .clickByCssSelector(dropdownPaneSelector + 'button.dropdown-toggle')
        .assertElementNotExists(dropdownPaneSelector + '.dropdown-menu li.custom_graph',
          'There is no possibility to run custom workflow for just created environment');
    },
    'Check that "Workflows" tab is worked'() {
      var buttonFilterSelector = '.deployment-graphs-toolbar .btn-filters';
      var filterByLevel = '.filter-by-graph_level';
      return this.remote
        .then(() => clusterPage.goToTab('Workflows'))
        // FIXME: Need to fetch graphs of all levels, so there shoul be more graphs in the list
        // Bug: https://bugs.launchpad.net/fuel/+bug/1606931        
        .assertElementsExist(tableRowSelector, 2,
          'Check if workflow table is presented and there are two rows in the table')
        .assertElementContainsText(tableRowSelector + ':first-child td:first-child',
          'Type "default"', 'The first row is default resulting graph for the cluster')
        .assertElementExists(tableRowSelector + ':last-child .btn-remove-graph',
          'There is a possibility to delete default cluster graph')
        .assertElementNotExists(tableRowSelector + ':first-child .btn-remove-graph',
          'There is no possibility to delete resulting graph for the cluster')
        .assertElementExists(buttonFilterSelector, 'Filter button for workflows tab is presented')
        // Check filters functionality
        .clickByCssSelector(buttonFilterSelector)
        .assertElementsExist('.filters ' + filterByLevel + ', .filters .filter-by-graph_type', 2,
          'Two filters are presented: filter for graph level and graph type')
        // Filter results by Level: plugin
        .clickByCssSelector(filterByLevel)
        .clickByCssSelector('input[name=plugin]')
        .assertElementNotExists(workflowTableSelector,
          'Workflows table doesn\'t have plugin workflows, so workflows table disappears')
        .assertElementExists('.alert-warning',
          'Warning message is shown and informs that no workflows matched applied filters.')
        .clickByCssSelector('.btn-reset-filters')
        .assertElementsExist(tableRowSelector, 2, 'Workflow table appers after filters reset');
    },
    'Check that user can upload new custom Workflow'() {
      var dialogUpload = '.upload-graph-form ';
      var dialogUploadError = dialogUpload + '.has-error';
      return this.remote
        .clickByCssSelector('.btn-upload-graph')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Upload New Workflow'))
        .assertElementsExist(dialogUpload, 'Upload graph form is presented in the dialog window')
        // Form validation check
        .then(() => modal.clickFooterButton('Upload'))
        .assertElementExists(dialogUploadError, 'There is an error due to type field is empty')
        .setInputValue(dialogUpload + 'input[name=type]', 'default')
        .then(() => modal.clickFooterButton('Upload'))
        .assertElementExists(dialogUploadError, 'There is an error due to this type already exists')
        .setInputValue(dialogUpload + 'input[name=name]', workflowName)
        .setInputValue(dialogUpload + 'input[name=type]', workflowName)
        .assertElementNotExists(dialogUploadError, 'Error message disappears after filling type')
        .then(() => modal.clickFooterButton('Upload'))
        .then(() => modal.waitToClose())
        .assertElementContainsText(tableRowSelector + ':last-child td:first-child',
          workflowName, 'New graph successfully uploaded');
    },
    'Check that custom Workflow can be executed'() {
      this.timeout = 90000;
      var customGraphSelector = 'select[name=customGraph]';
      return this.remote
        .then(() => clusterPage.goToTab('Dashboard'))
        .then(() => dashboardLib.changeDeploymentMode('Workflow'))
        .assertElementPropertyEquals(customGraphSelector, 'value', workflowName,
          'Custom workflow dropdown exists and shows just uploaded new graph')
        .assertElementContainsText('.btn-run-graph', 'Run Workflow on 1 Node',
          'Workflow runs on 1 node')
        .clickByCssSelector('.btn-run-graph')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Run Custom Workflow'))
        .assertElementContainsText('.confirmation-question',
          'Click Run Workflow to execute custom deployment tasks on the selected nodes.',
          'Confirmation quiestion is shown')
        .then(() => modal.clickFooterButton('Run Workflow'))
        .waitForElementDeletion('.confirmation-question', 5000)
        .assertElementContainsText('.modal-body', 'Deployment tasks not found for',
          'Workflow can not be started because it contains no deployment tasks')
        .then(() => modal.clickFooterButton('Close'))
        .then(() => modal.waitToClose())
        .then(() => dashboardLib.changeDeploymentMode('Deploy'))
        .then(() => dashboardPage.startDeployment())
        .waitForElementDeletion('.dashboard-block .progress', 60000)
        .assertElementExists('.actions-panel', 'Action panel is shown on Dashboard')
        .assertElementPropertyEquals(customGraphSelector, 'value', workflowName,
          'Custom workflow dropdown is shown on the dashboard for the operational cluster')
        .assertElementContainsText('.btn-run-graph', 'Run Workflow on 1 Node',
          'There is possibility to run custom graph for operational cluster');
    },
    'Check that user can delete Workflow'() {
      var deleteWorkflowSelector = '.modal-footer .remove-graph-btn';
      return this.remote
        .then(() => clusterPage.goToTab('Workflows'))
        .clickByCssSelector(tableRowSelector + ':last-child .btn-remove-graph')
        .then(() => modal.waitToOpen())
        .then(() => modal.checkTitle('Delete Workflow'))
        .assertElementExists('.modal-dialog .text-danger',
          'Warning message is shown to prevent accidental graph removing')
        .then(() => modal.clickFooterButton('Delete'))
        .assertElementExists('.confirmation-form', 'Confirmation form for graph removing is shown')
        .assertElementDisabled(deleteWorkflowSelector,
          'Delete button is disabled, until requested confirmation text will be entered')
        .setInputValue('.confirmation-form input[type=text]', workflowName)
        .assertElementEnabled(deleteWorkflowSelector,
          'Delete button is enabled after requested confirmation text entered')
        .then(() => modal.clickFooterButton('Delete'))
        .then(() => modal.waitToClose())
        // FIXME: Custom graph will be not the last in the list
        // Bug: https://bugs.launchpad.net/fuel/+bug/1606931
        .assertElementNotContainsText(tableRowSelector + ':last-child td:first-child', workflowName,
          'The graph was successfully deleted');
    }
  };
});
