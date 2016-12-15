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

define([
  'intern!object',
  'tests/functional/pages/common',
  'tests/functional/pages/cluster',
  'tests/functional/pages/dashboard',
  'tests/functional/pages/modal'
], function(registerSuite, Common, ClusterPage, DashboardPage, ModalWindow) {
  'use strict';

  registerSuite(function() {
    var common,
      clusterPage,
      dashboardPage,
      clusterName,
      modal;

    return {
      name: 'Workflows',
      setup: function() {
        common = new Common(this.remote);
        clusterPage = new ClusterPage(this.remote);
        clusterName = common.pickRandomName('Test Cluster');
        dashboardPage = new DashboardPage(this.remote);
        modal = new ModalWindow(this.remote);

        return this.remote
          .then(function() {
            return common.getIn();
          })
          .then(function() {
            return common.createCluster(clusterName);
          })
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          });
      },
      'Test Dashboard tab without custom workflow deployment mode': function() {
        return this.remote
          .then(function() {
            return clusterPage.goToTab('Dashboard');
          })
          .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
          .assertElementNotExists(
            '.actions-panel .dropdown .dropdown-menu li.custom_graph',
            'There is no possibility to run custom workflow for just created environment'
          );
      },
      'Test Workflows tab view and filters': function() {
        return this.remote
          .then(function() {
            return clusterPage.goToTab('Workflows');
          })
          .assertElementsExist(
            '.workflows-table tbody tr',
            3,
            'Workflows table includes release- and cluster-level default workflows'
          )
          .assertElementContainsText(
            '.workflows-table tbody tr.subheader td:first-child',
              'Type "default"',
              'The first row is default resulting graph for the cluster'
          )
          .assertElementExists(
            '.workflows-table tbody tr:last-child .btn-remove-graph',
            'There is a possibility to delete default cluster graph'
          )
          .assertElementNotExists(
            '.workflows-table tbody tr.subheader .btn-remove-graph',
            'There is no possibility to delete resulting graph for the cluster'
          )
          .assertElementExists(
            '.deployment-graphs-toolbar .btn-filters',
            'Filter button for workflows tab is presented'
          )
          // Check filters functionality
          .clickByCssSelector('.deployment-graphs-toolbar .btn-filters')
          .assertElementsExist(
            '.filters .filter-by-graph_level, .filters .filter-by-graph_type',
            2,
            'Two filters are presented: filter for graph level and graph type'
          )
          // Filter results by Level: plugin
          .clickByCssSelector('.filter-by-graph_level')
          .clickByCssSelector('input[name=plugin]')
          .assertElementNotExists(
            '.workflows-table',
            'Workflows table doesn\'t have plugin workflows, so workflows table disappears'
          )
          .assertElementExists(
            '.alert-warning',
            'Warning message is shown and informs that no workflows matched applied filters.'
          )
          .clickByCssSelector('.btn-reset-filters')
          .assertElementsExist(
            '.workflows-table tbody tr',
            3,
            'Workflow table is presented again after filters reset'
          );
      },
      'Test upload new custom Workflow': function() {
        return this.remote
          .clickByCssSelector('.btn-upload-graph')
          .then(function() {
            return modal.waitToOpen();
          })
          .then(function() {
            return modal.checkTitle('Upload New Workflow');
          })
          // Form validation check
          .then(function() {
            return modal.clickFooterButton('Upload');
          })
          .assertElementExists(
            '.upload-graph-form .has-error',
            'There is an error in the form in case type field is empty'
          )
          .setInputValue('.upload-graph-form input[name=type]', 'default')
          .then(function() {
            return modal.clickFooterButton('Upload');
          })
          .assertElementExists(
            '.upload-graph-form .has-error',
            'There is an error in the form if graph with this type already exists'
          )
          .setInputValue('.upload-graph-form input[name=name]', 'loremipsum')
          .setInputValue('.upload-graph-form input[name=type]', 'loremipsum')
          .assertElementNotExists(
            '.upload-graph-form .has-error',
            'Error message disappears after filling type field'
          )
          .then(function() {
            return modal.clickFooterButton('Upload');
          })
          .then(function() {
            return modal.waitToClose();
          })
          .assertElementContainsText(
            '.workflows-table tbody tr:last-child td:first-child',
            'loremipsum',
            'New graph successfully uploaded'
          );
      },
      'Test run custom Workflow from Dashboard tab': function() {
        this.timeout = 150000;
        return this.remote
          .then(function() {
            return clusterPage.goToTab('Dashboard');
          })
          .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
          .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.custom_graph button')
          .assertElementPropertyEquals(
            'select[name=customGraph]',
            'value',
            'loremipsum',
            'Custom workflow dropdown exists and shows just uploaded "loremipsum" graph'
          )
          .assertElementContainsText(
            '.btn-run-graph',
            'Run Workflow on 1 Node',
            'Workflow runs on 1 node'
          )
          .clickByCssSelector('.btn-run-graph')
          .then(function() {
            return modal.waitToOpen();
          })
          .then(function() {
            return modal.checkTitle('Run Custom Workflow');
          })
          .assertElementContainsText(
            '.confirmation-question',
            'Click Run Workflow to execute custom deployment tasks on the selected nodes.',
            'Confirmation quiestion is shown'
          )
          .then(function() {
            return modal.clickFooterButton('Run Workflow');
          })
          .waitForElementDeletion('.confirmation-question', 5000)
          .assertElementContainsText(
            '.modal-body',
            'There are no deployment tasks for graph type',
            'Workflow can not be started because it contains no deployment tasks'
          )
          .then(function() {
            return modal.clickFooterButton('Close');
          })
          .then(function() {
            return modal.waitToClose();
          })
          .clickByCssSelector('.actions-panel .dropdown button.dropdown-toggle')
          .clickByCssSelector('.actions-panel .dropdown .dropdown-menu li.deploy button')
          .then(function() {
            return dashboardPage.startDeployment();
          })
          .waitForElementDeletion('.dashboard-block .progress', 60000)
          .assertElementAppears('.actions-panel', 5000, 'Action panel is shown on Dashboard')
          .assertElementPropertyEquals(
            'select[name=customGraph]',
            'value',
            'loremipsum',
            'Custom workflow dropdown is shown on the dashboard for the operational cluster'
          )
          .assertElementContainsText(
            '.btn-run-graph',
            'Run Workflow on 1 Node',
            'There is possibility to run custom graph for operational cluster'
          );
      },
      'Test delete Workflow': function() {
        return this.remote
          .then(function() {
            return clusterPage.goToTab('Workflows');
          })
          .clickByCssSelector('.workflows-table tbody tr:last-child .btn-remove-graph')
          .then(function() {
            return modal.waitToOpen();
          })
          .then(function() {
            return modal.checkTitle('Delete Workflow');
          })
          .assertElementExists(
            '.modal-dialog .text-danger',
            'Warning message is shown to prevent accidental graph removing'
          )
          .then(function() {
            return modal.clickFooterButton('Delete');
          })
          .assertElementExists(
            '.confirmation-form',
            'Confirmation form for graph removing is shown'
          )
          .assertElementDisabled(
            '.modal-footer .remove-graph-btn',
            'Delete button is disabled, until requested confirmation text will be entered'
          )
          .setInputValue('.confirmation-form input[type=text]', 'loremipsum')
          .assertElementEnabled(
            '.modal-footer .remove-graph-btn',
            'Delete button is enabled after requested confirmation text entered'
          )
          .then(function() {
            return modal.clickFooterButton('Delete');
          })
          .then(function() {
            return modal.waitToClose();
          })
          .assertElementNotContainsText(
            '.workflows-table tbody tr:last-child td:first-child',
            'loremipsum', 'The graph was successfully deleted'
          );
      }
    };
  });
});
