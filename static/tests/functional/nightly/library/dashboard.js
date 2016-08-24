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

import _ from 'intern/dojo/node!lodash';
import 'tests/functional/helpers';
import ModalWindow from 'tests/functional/pages/modal';
import EquipmentLib from 'tests/functional/nightly/library/equipment';

class DashboardLib {
  constructor(remote) {
    this.remote = remote;
    this.modal = new ModalWindow(remote);
    this.equipmentLib = new EquipmentLib(remote);

    this.dashboardTabSelector = 'div.dashboard-tab ';
    this.progressSelector = this.dashboardTabSelector + 'div.progress';
    this.alertSelector = this.dashboardTabSelector + 'div.alert ';
    this.horizonPaneSelector = this.dashboardTabSelector + 'div.dashboard-block.clearfix';
    this.deployPaneSelector = this.dashboardTabSelector + 'div.actions-panel ';
    this.actionDescriptionSelector = this.deployPaneSelector + 'div.action-description';
    this.changesListPaneSelector = this.deployPaneSelector + 'div.changes-list ';
    this.changesListSelector = this.changesListPaneSelector + 'ul';
    this.btnDeploySelector = this.changesListPaneSelector + '.deploy-btn';
    this.btnProvisionSelector = this.changesListPaneSelector + '.btn-provision';
    this.btnDeploymentSelector = this.changesListPaneSelector + '.btn-deploy-nodes';
    this.stopDeployBtn = 'button.stop-deployment-btn';
    this.btnDropdownSelector = this.changesListPaneSelector + '.btn.dropdown-toggle';
    this.btnChooseNodesSelector = this.changesListPaneSelector + '.btn-select-nodes';
    this.taskAlertsSelector = this.deployPaneSelector + 'div.task-alerts';
    this.deployModePaneSelector = this.deployPaneSelector + 'div.action-dropdown ';
    this.deployModeSelector = this.deployModePaneSelector + 'button.dropdown-toggle';

    this.modalDialogSelector = 'div.modal-dialog ';
    this.modalDescriptionSelector = this.modalDialogSelector + 'div.modal-body ';
    this.nodeListSelector = this.modalDescriptionSelector + 'div.node-list ';
    this.nodeSelector = 'div.node';
    this.selectAllMainSelector = this.nodeListSelector + 'div.node-list-header input';
    this.btnCloseModalSelector = this.modalDialogSelector + 'button.btn.btn-default';
    this.btnStartDeploySelector = this.modalDialogSelector + '.start-deployment-btn';
    this.btnStartProvisionSelector = this.modalDialogSelector + '.start-provision-btn';
    this.btnStartDeploymentSelector = this.modalDialogSelector + '.start-nodes-deployment-btn';
    this.btnSelectNodesSelector = this.modalDialogSelector + '.btn-select-nodes';
  }

  changeDeploymentMode(deploymentModeName) {
    var deployModeMenuSelector = this.deployModePaneSelector + 'ul.dropdown-menu ';
    var properNames = ['Deploy', 'Provision', 'Deployment', 'Workflow'];
    var menuNames =
      ['Provisioning + Deployment', 'Provisioning only', 'Deployment only', 'Custom Workflow'];
    var menuSelectors = ['deploy', 'provision', 'deployment', 'custom_graph'];
    // There are items indexes of dopdown menu to check proper values in it
    var firstItemIndex = properNames.indexOf(deploymentModeName);
    var secondItemIndex = properNames.length - firstItemIndex;
    if (!_.includes(properNames, deploymentModeName)) {
      throw new Error('Invalid input value. Check deployment mode name: "' + deploymentModeName +
        '" parameter and restart test. True values: ' + properNames);
    }
    return this.remote
      .assertElementsAppear(this.deployPaneSelector, 1000, '"Deployment" pane appears')
      .assertElementsExist(this.deployModeSelector, '"Deploy mode" link exists')
      .findByCssSelector(this.deployModeSelector)
        .getVisibleText()
        .then((actualModeName) => {
          if (actualModeName !== menuNames[firstItemIndex]) {
            secondItemIndex -= menuNames.indexOf(actualModeName);
            var firstItemSelector = deployModeMenuSelector + 'li.' +
              menuSelectors[firstItemIndex] + ' .btn-link';
            var secondItemSelector = deployModeMenuSelector + 'li.' +
              menuSelectors[secondItemIndex] + ' .btn-link';
            return this.remote
              .assertElementNotDisplayed(deployModeMenuSelector,
                '"Deployment Mode" menu is not displayed by default')
              .clickByCssSelector(this.deployModeSelector)
              .assertElementDisplayed(deployModeMenuSelector, 'Deployment Mode" menu appears')
              .assertElementsExist(firstItemSelector,
                '"' + menuNames[firstItemIndex] + '" menu item exists')
              .assertElementsExist(secondItemSelector,
                '"' + menuNames[secondItemIndex] + '" menu item exists')
              .assertElementTextEquals(firstItemSelector, menuNames[firstItemIndex],
                '"' + menuNames[firstItemIndex] + '" menu item has correct name')
              .assertElementTextEquals(secondItemSelector, menuNames[secondItemIndex],
                '"' + menuNames[secondItemIndex] + '" menu item has correct name')
              .clickByCssSelector(firstItemSelector)
              .assertElementNotDisplayed(deployModeMenuSelector,
                '"Deployment Mode" menu disappears')
              .assertElementsAppear(this.deployModeSelector, 500, '"Deployment mode" link appears')
              .assertElementTextEquals(this.deployModeSelector, menuNames[firstItemIndex],
                '"' + menuNames[firstItemIndex] + '" mode link has correct name');
          } else {
            return false;
          }
        })
        .end();
  }

  genericModeCheck(deployMode, actionDescription, taskAlerts, changesList, btnSelector, btnName) {
    var chain = this.remote;
    chain = chain.then(() => this.changeDeploymentMode(deployMode))
    .assertElementsExist(this.actionDescriptionSelector,
      '"' + deployMode + ' Action description" message exists')
    .assertElementMatchesRegExp(this.actionDescriptionSelector, RegExp(actionDescription, 'i'),
      '"' + deployMode + ' Action description" message is correct');
    if (deployMode.toLowerCase() === 'deploy') {
      chain = chain.assertElementsExist(this.taskAlertsSelector,
        '"' + deployMode + ' Task alerts" message exists')
      .assertElementMatchesRegExp(this.taskAlertsSelector, RegExp(taskAlerts, 'i'),
        '"' + deployMode + ' Task alerts" message is correct');
    }
    chain = chain.assertElementsExist(btnSelector, '"' + deployMode + '" button exists')
    .assertElementMatchesRegExp(btnSelector, RegExp(btnName, 'i'),
      '"' + deployMode + '" button name is correct');
    if (changesList !== '') {
      chain = chain.assertElementsExist(this.changesListSelector,
      '"' + deployMode + ' Changes list" message exists')
      .assertElementMatchesRegExp(this.changesListSelector, RegExp(changesList, 'i'),
        '"' + deployMode + ' Changes list" message is correct');
    }
    return chain;
  }

  horizonModeCheck() {
    var horizonDescription = 'Horizon[\\s\\S]*The OpenStack dashboard Horizon is now available.';
    return this.remote
      .assertElementsAppear(this.horizonPaneSelector, 1000, '"Horizon" pane appears')
      .assertElementMatchesRegExp(this.horizonPaneSelector, RegExp(horizonDescription, 'i'),
        '"Horizon" pane description is correct');
  }

  checkDeployModeState(totalNodes, offlineNodes, errorNodes, provisionNodes, deployNodes) {
    var doneNodes = provisionNodes + deployNodes;
    var deltaNodes = totalNodes - doneNodes;
    var btnSelector = this.btnDeploySelector;
    var btnName = 'Deploy Changes';
    var deploymentMode = 'Deploy';
    var offlineTaskAlert =
      'Deployment cannot be started due to invalid environment configuration. Please ' +
      'review and address the warnings below before proceeding[\\s\\S]*' +
      offlineNodes + ' node.*offline[\\s\\S]*';
    var defaultTaskAlert =
      'TLS is not enabled. It is highly recommended to enable and configure TLS[\\s\\S]*' +
      'It is recommended to have at least[\\s\\S]*' +
      'Please verify your network settings before deployment. For more information ' +
      'please visit the Networks tab[\\s\\S]*';
    var changesList = ' node(|s)';
    var addedMsg = 'Added ' + deltaNodes + changesList;
    var provisionedMsg = 'Provisioned ' + provisionNodes + changesList;
    changesList = addedMsg;
    var envReady = false;
    if (totalNodes <= 0) {
      throw new Error('Can not check "Deploy" mode for environment with no one node.');
    } else if (totalNodes <= deployNodes) {
      envReady = true;
    } else if (totalNodes < (doneNodes + offlineNodes + errorNodes)) {
      throw new Error('Invalid input "' + deploymentMode + '" nodes quantity.');
    } else if (provisionNodes !== 0) {
      if (totalNodes === doneNodes) {
        changesList = provisionedMsg;
      } else {
        changesList += '[\\s\\S]*' + provisionedMsg;
      }
    }
    if (offlineNodes === 0) {
      btnSelector += ':enabled';
    } else {
      btnSelector += ':not(:enabled)';
      defaultTaskAlert = offlineTaskAlert + defaultTaskAlert;
    }
    var chain = this.remote;
    if (envReady) {
      chain = chain.then(() => this.horizonModeCheck());
    } else {
      chain = chain.then(() => this.genericModeCheck(deploymentMode, '', defaultTaskAlert,
        changesList, btnSelector, btnName));
    }
    return chain;
  }

  checkProvisionModeState(totalNodes, offlineNodes, errorNodes, provisionNodes, deployNodes) {
    var doneNodes = offlineNodes + errorNodes + provisionNodes + deployNodes;
    var deltaNodes = totalNodes - errorNodes - provisionNodes - deployNodes;
    var btnSelector = this.btnProvisionSelector;
    var btnName = 'Provision ';
    var deploymentMode = 'Provision';
    var defaultDescription = '"Provisioning only" installs the previously selected operating ' +
      'system Ubuntu on the nodes, but does not deploy OpenStack services[\\s\\S]*' +
      'To deploy OpenStack services after provisioning has been completed, select "Deployment ' +
      'only" from the Deployment Mode dropdown. To complete provisioning and deployment at the ' +
      'same time, select "Provisioning.*Deployment" from the Deployment Mode dropdown.';
    var emptyDescription = 'Nodes must be assigned a role in order to be provisioned. Please use ' +
      'the "Add Nodes" button to add roles to available discovered nodes before proceed[\\s\\S]*' +
      'Please select "Deployment only" or "Provisioning.*Deployment" from the Deployment Mode ' +
      'dropdown to continue with already provisioned nodes.';
    var changesList = deltaNodes + ' node.*discovered';
    if (totalNodes <= 0) {
      throw new Error('Can not "Provision" environment with no one node.');
    } else if (totalNodes <= deployNodes) {
      throw new Error('Can not "Provision" environment that already deployed.');
    } else if (totalNodes > doneNodes) {
      btnSelector += ':enabled';
      if (offlineNodes === 0) {
        btnName += deltaNodes + ' Node(|s)';
      } else {
        btnName += (deltaNodes - offlineNodes) + ' of ' + deltaNodes + ' Nodes';
        changesList += '[\\s\\S]*' + offlineNodes + ' node.*offline';
      }
    } else if (totalNodes === doneNodes) {
      btnSelector += ':not(:enabled)';
      defaultDescription = emptyDescription;
      if (offlineNodes === 0) {
        btnName += 'Nodes';
        changesList = '';
      } else {
        btnName += offlineNodes + ' Node(|s)';
        changesList += '[\\s\\S]*' + offlineNodes + ' node.*offline';
      }
    } else {
      throw new Error('Invalid input "' + deploymentMode + '" nodes quantity.');
    }
    return this.remote
      .then(() => this.genericModeCheck(deploymentMode, defaultDescription, '', changesList,
        btnSelector, btnName));
  }

  checkDeploymentModeState(totalNodes, offlineNodes, errorNodes, provisionNodes, deployNodes) {
    var doneNodes = offlineNodes + errorNodes + provisionNodes + deployNodes;
    var btnSelector = this.btnDeploymentSelector;
    var btnName = 'Deploy ';
    var deploymentMode = 'Deployment';
    var deploymentDescription =
      '"Advanced deployment" deploys OpenStack services on nodes which have the operating system ' +
      'already provisioned[\\s\\S]*To complete provisioning and deployment at the same time, ' +
      'select "Provisioning.*Deployment" from the Deployment Mode dropdown.';
    var emptyDescription =
      'Nodes can only be deployed using the "Deployment only" feature if they have been ' +
      'provisioned with an operating system[\\s\\S]*Please select "Provisioning only" or ' +
      '"Provisioning.*Deployment" from the Deployment Mode dropdown to continue.';
    var changesList = provisionNodes + ' node.*provisioned';
    if (totalNodes <= 0) {
      throw new Error('Can not "Deployment" no one node.');
    } else if (totalNodes <= deployNodes) {
      throw new Error('Can not "Deployment" nodes at environment that already deployed.');
    } else if (totalNodes >= doneNodes) {
      if (provisionNodes === 0) {
        btnSelector += ':not(:enabled)';
        btnName += 'Nodes';
        deploymentDescription = emptyDescription;
        changesList = '';
      } else {
        btnSelector += ':enabled';
        btnName += provisionNodes + ' Node(|s)';
      }
    } else {
      throw new Error('Invalid input "' + deploymentMode + '" nodes quantity.');
    }
    return this.remote
      .then(() => this.genericModeCheck(deploymentMode, deploymentDescription, '', changesList,
        btnSelector, btnName));
  }

  genericModalCheck(paneName, btnMOpen, modalName, modalText, btnStart, btnStartName, resultMsg) {
    var successMsg = 'Success';
    var successSelector = this.alertSelector + 'strong';
    var messageSelector = this.alertSelector + 'span';
    return this.remote
      // PreCheck
      .assertElementsAppear(this.deployPaneSelector, 1000, paneName + ' pane appears')
      .assertElementEnabled(btnMOpen, '"' + btnStartName + '" button is available')
      .clickByCssSelector(btnMOpen)
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle(modalName))
      .assertElementsExist(this.modalDescriptionSelector, paneName + ' modal description exists')
      .assertElementMatchesRegExp(this.modalDescriptionSelector, RegExp(modalText, 'i'),
        paneName + ' modal description is correct')
      .assertElementEnabled(this.btnCloseModalSelector, '"Cancel" button is available')
      .assertElementEnabled(btnStart, '"' + btnStartName + '" start button is available')
      .assertElementMatchesRegExp(btnStart, RegExp(btnStartName, 'i'),
        '"' + btnStartName + '" start button description is correct')
      .clickByCssSelector(btnStart)
      .assertElementsAppear(this.progressSelector, 10000, paneName + ' is started')
      .assertElementDisappears(this.progressSelector, 45000, paneName + ' is finished')
      // PostCheck
      .assertElementsAppear(this.alertSelector, 1000, paneName + ' result pane appears')
      .assertElementMatchesRegExp(successSelector, RegExp(successMsg, 'i'),
        paneName + ' result pane message is correct')
      .assertElementMatchesRegExp(messageSelector, RegExp(resultMsg, 'i'),
        paneName + ' result pane message is correct');
  }

  deployNodes(clusterName, totalNodes, offlineNodes, errorNodes, provisionNodes, deployNodes) {
    var doneNodes = provisionNodes + deployNodes;
    var paneName = '"Provisioning + Deployment"';
    var deployTitle = 'Deploy Changes';
    var deployDescription = 'Before proceeding with deployment please verify that the nodes ' +
      'have disk partitioning and network interfaces configured properly. You will not be able ' +
      'to change these via UI after the cloud is deployed[\\s\\S]*Packages and updates are ' +
      'fetched from the repositories defined in the Settings tab. If your environment uses the ' +
      'default external repositories, verify that the Fuel Master node can access the Interne.*' +
      'If the Fuel Master node is not connected to the Internet, you must set up a local ' +
      'mirror and configure Fuel to upload packages from the local mirror. Fuel must have ' +
      'network access to the local mirror[\\s\\S]*Click Deploy to start the deployment or Cancel ' +
      'to make changes.';
    var deployBtnName = 'Deploy';
    var deployResultMsg = '[\\s\\S]*Deployment of environment \'' + clusterName + '\' is done.';
    var provisionMsg = '[\\s\\S]*Provision of ';
    if (offlineNodes >= 1) {
      throw new Error('Can not "Deploy" environment with offline nodes.');
    }
    if (totalNodes <= 0) {
      throw new Error('Can not "Deploy" environment with no one node.');
    } else if (totalNodes <= deployNodes) {
      throw new Error('Can not "Deploy" environment that already deployed.');
    } else if ((totalNodes > doneNodes) || (totalNodes === (doneNodes + errorNodes))) {
      if (deployNodes === 0) {
        provisionMsg += 'environment \'' + clusterName + '\' is done.';
      } else {
        provisionMsg += (totalNodes - doneNodes) + ' environment node.*is done.';
      }
      deployResultMsg = '(' + deployResultMsg + '|' + provisionMsg + '){2}';
    } else if (totalNodes === doneNodes) {
      deployDescription = 'Click Deploy to start the deployment or Cancel to make changes.';
    } else {
      throw new Error('Invalid input nodes quantity. Recheck and start again.');
    }
    return this.remote
      .then(() => this.genericModalCheck(paneName, this.btnDeploySelector, deployTitle,
        deployDescription, this.btnStartDeploySelector, deployBtnName, deployResultMsg));
  }

  provisionNodes(clusterName, totalNodes, offlineNodes, errorNodes, provisionNodes, deployNodes) {
    var doneNodes = deployNodes + offlineNodes + errorNodes;
    var paneName = '"Provisioning only"';
    var provisionTitle = 'Provision Nodes';
    var provisionDescription = 'Before you proceed, review the nodes configuration, including ' +
      'roles, disk partitioning and interfaces configuration. You will not be able to change ' +
      'these settings after Fuel provisions the nodes[\\s\\S]*Packages and updates are fetched ' +
      'from the repositories defined in the Settings tab. If your environment uses the default ' +
      'external repositories, verify that the Fuel Master node can access the Internet. If the ' +
      'Fuel Master node is not connected to the Internet, you must set up a local mirror and ' +
      'configure Fuel to upload packages from the local mirror. Fuel must have network access to ' +
      'the local mirror. You may also configure alternate repositories for installation[\\s\\S]*' +
      'Click Start Provisioning to provision the operating system onto the environment nodes, or ' +
      'Cancel to make changes.';
    var provisionBtnName = 'Provision ' + provisionNodes + ' Node(|s)';
    var provisionResultMsg = 'Provision of ';
    if (totalNodes <= 0) {
      throw new Error('Can not "Provision" environment with no one node.');
    } else if (totalNodes <= deployNodes) {
      throw new Error('Can not "Provision" environment that already deployed.');
    } else if (totalNodes < doneNodes) {
      throw new Error('Invalid input "' + paneName + '" nodes quantity.');
    }
    if (totalNodes === provisionNodes) {
      provisionResultMsg += 'environment \'' + clusterName + '\' is done.';
    } else {
      provisionResultMsg += provisionNodes + ' environment node.*is done.';
    }
    return this.remote
      .then(() => this.genericModalCheck(paneName, this.btnProvisionSelector, provisionTitle,
        provisionDescription, this.btnStartProvisionSelector, provisionBtnName, provisionResultMsg))
      ;
  }

  deployOnlyNodes(clusterName, totalNodes, offlineNodes, errorNodes, provisionNodes, deployNodes) {
    var doneNodes = provisionNodes + offlineNodes + errorNodes;
    var paneName = '"Deployment only"';
    var deployTitle = 'Deploy Nodes';
    var deployDescription = 'Before you proceed, review role configuration of the nodes. You ' +
      'will not be able to change node roles after Fuel deploys it[\\s\\S]*Packages and updates ' +
      'are fetched from the repositories defined in the Settings tab. If your environment uses ' +
      'the default external repositories, verify that the Fuel Master node can access the ' +
      'Internet. If the Fuel Master node is not connected to the Internet, you must set up a ' +
      'local mirror and configure Fuel to upload packages from the local mirror. Fuel must have ' +
      'network access to the local mirror. You may also configure alternate repositories for ' +
      'installation[\\s\\S]*Click Start Deployment to start the deployment or Cancel to make ' +
      'changes.';
    var deployBtnName = 'Deploy ' + deployNodes + ' Node(|s)';
    var deployResultMsg = 'Deployment of ';
    if (totalNodes <= 0) {
      throw new Error('Can not "Deploy" environment with no one node.');
    } else if (totalNodes < deployNodes) {
      throw new Error('Can not "Deploy" environment that already deployed.');
    } else if (totalNodes < doneNodes) {
      throw new Error('Invalid input "' + paneName + '" nodes quantity.');
    }
    if (totalNodes === deployNodes) {
      deployResultMsg += 'environment \'' + clusterName + '\' is done.';
    } else {
      deployResultMsg += deployNodes + ' environment node.*is done.';
    }
    return this.remote
      .then(() => this.genericModalCheck(paneName, this.btnDeploymentSelector, deployTitle,
        deployDescription, this.btnStartDeploymentSelector, deployBtnName, deployResultMsg));
  }

  deepNodesCheck(totalNodes, deepCheck) {
    // deepCheck - Array[controllerName, computeName, statusArray]
    var nameSelector = this.nodeSelector + ' div.node-name p';
    var alertSelector = this.nodeListSelector + 'div.alert-warning';
    var alertMessage = 'No nodes found matching the selected filters.';
    return this.remote
      // Quick Searchs
      .then(() => this.equipmentLib.activateQuickSearch())
      .then(() => this.equipmentLib.checkQuickSearch(this.nodeSelector, totalNodes, nameSelector,
        deepCheck[0], deepCheck[0]))
      .then(() => this.equipmentLib.checkQuickSearch(this.nodeSelector, totalNodes, nameSelector,
        deepCheck[1], deepCheck[1]))
      // Filtering
      .then(() => this.equipmentLib.activateFiltering())
      .then(() => this.equipmentLib.setFilterByStatus(deepCheck[2]))
      .assertElementsAppear(alertSelector, 1000, 'Warning message appears')
      .assertElementTextEquals(alertSelector, alertMessage, 'Warning message is correct')
      .then(() => this.equipmentLib.deactivateFiltering())
      .assertElementDisappears(alertSelector, 1000, 'Warning message disappears')
      // Sorting
      .then(() => this.equipmentLib.activateSorting());
  }

  selectNodes(paneName, initContollers, initCompute, selectContollers, selectCompute, deepCheck) {
    // deepCheck - activate Quick Search, Sorting and Filtering nodes selection dialog check
    paneName = '"' + paneName + '"';
    var initNodes = initContollers + initCompute;
    var todoNodes = selectContollers + selectCompute;
    var modalTitle = 'Select Nodes';
    var controllerHeader = 'Controller.*' + initContollers + '.*';
    var computeHeader = 'Compute.*' + initCompute + '.*';
    var btnSelectNodesName = 'Select ' + todoNodes + ' Node(|s)';
    var controllerGroupSel = this.nodeListSelector + 'div.nodes-group:first-child ';
    var computeGroupSel = this.nodeListSelector + 'div.nodes-group:last-child ';
    var selNodeSel = this.nodeSelector + '.selected';
    var btnGenericDeploySel = this.changesListPaneSelector + '.btn-primary:first-child';
    var btnGenericDeployName = '.*' + todoNodes + ' of ' + initNodes + ' Nodes';
    var chain = this.remote;

    // Precondition
    chain = chain.assertElementsAppear(this.deployPaneSelector, 1000, paneName + ' pane appears')
    .assertElementEnabled(this.btnDropdownSelector,
      paneName + ' dropdown select nodes button is available')
    .clickByCssSelector(this.btnDropdownSelector)
    .assertElementsAppear(this.btnChooseNodesSelector, 500,
      paneName + ' select nodes button appears')
    .clickByCssSelector(this.btnChooseNodesSelector)
    .then(() => this.modal.waitToOpen())
    .then(() => this.modal.checkTitle(modalTitle))
    .assertElementsAppear(this.nodeListSelector, 500, paneName + ' node list appears');
    // Deep check
    if (deepCheck) {
      chain = chain.then(() => this.deepNodesCheck(initNodes, deepCheck));
    }
    // Check nodes grouping
    chain = chain.assertElementsExist(controllerGroupSel, paneName + ' controller group exists')
    .assertElementsExist(computeGroupSel, paneName + ' compute group exists')
    .assertElementMatchesRegExp(controllerGroupSel + 'h4', RegExp(controllerHeader, 'i'),
      paneName + ' controller group description is correct')
    .assertElementMatchesRegExp(computeGroupSel + 'h4', RegExp(computeHeader, 'i'),
      paneName + ' compute group description is correct')
    .findAllByCssSelector(controllerGroupSel + selNodeSel)
      .then((nodeCount) => {
        if (nodeCount.length !== initContollers) {
          throw new Error('Nodes grouping is not worked for: "' + controllerHeader + '"');
        }
      })
      .end()
    .findAllByCssSelector(computeGroupSel + selNodeSel)
      .then((nodeCount) => {
        if (nodeCount.length !== initCompute) {
          throw new Error('Nodes grouping is not worked for: "' + computeHeader + '"');
        }
      })
      .end()
    // Select required nodes
    .assertElementsExist(this.selectAllMainSelector + ':checked',
      paneName + ' select all checkbox exists and selected')
    .clickByCssSelector(this.selectAllMainSelector)
    .assertElementsExist(this.selectAllMainSelector + ':not(:checked)',
      paneName + ' select all checkbox exists and not selected');
    for (let i = 0; i < selectContollers; i++) {
      chain = chain.clickByCssSelector(controllerGroupSel + this.nodeSelector);
    }
    for (let i = 0; i < selectCompute; i++) {
      chain = chain.clickByCssSelector(computeGroupSel + this.nodeSelector);
    }
    chain = chain.findAllByCssSelector(controllerGroupSel + selNodeSel)
      .then((nodeCount) => {
        if (nodeCount.length !== selectContollers) {
          throw new Error('Node selection is not worked for: "' + controllerHeader + '"');
        }
      })
      .end()
    .findAllByCssSelector(computeGroupSel + selNodeSel)
      .then((nodeCount) => {
        if (nodeCount.length !== selectCompute) {
          throw new Error('Nodes selection is not worked for: "' + computeHeader + '"');
        }
      })
      .end()
    // Postcondition
    .assertElementEnabled(this.btnCloseModalSelector, '"Cancel" button is available')
    .assertElementEnabled(this.btnSelectNodesSelector,
      '"' + btnSelectNodesName + '" select nodes button is available')
    .assertElementMatchesRegExp(this.btnSelectNodesSelector, RegExp(btnSelectNodesName, 'i'),
      '"' + btnSelectNodesName + '" select nodes button description is correct')
    .clickByCssSelector(this.btnSelectNodesSelector)
    .then(() => this.modal.waitToClose())
    .assertElementsAppear(btnGenericDeploySel, 1000, paneName + ' button appears')
    .assertElementMatchesRegExp(btnGenericDeploySel, RegExp(btnGenericDeployName, 'i'),
      paneName + ' button description is correct');
    return chain;
  }

  checkWarningNotContainsNote(warningText) {
    var textWarningSelector = '.display-changes-dialog > div ';
    var firstWarning = '> :nth-child(1) .instruction';
    var secondWarning = '> :nth-child(2) .instruction';
    return this.remote
      .clickByCssSelector(this.btnDeploySelector)
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle('Deploy Changes'))
      .assertElementNotContainsText(textWarningSelector + firstWarning, warningText,
              'Warning does not contain a note about configuration changes')
      .assertElementNotContainsText(textWarningSelector + secondWarning, warningText,
              'Warning does not contain a note about configuration changes')
      .then(() => this.modal.clickFooterButton('Cancel'))
      .then(() => this.modal.waitToClose());
  }

  checkWarningContainsNote(warningText) {
    var warningSelector = '.instruction';
    return this.remote
      .clickByCssSelector(this.btnDeploySelector)
      .then(() => this.modal.waitToOpen())
      .then(() => this.modal.checkTitle('Deploy Changes'))
      .assertElementContainsText(warningSelector, warningText,
              'Warning contains a note about configuration changes')
      .then(() => this.modal.clickFooterButton('Cancel'))
      .then(() => this.modal.waitToClose());
  }
}

export default DashboardLib;
