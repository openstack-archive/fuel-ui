/*
 * Copyright 2016 Mirantis, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may
 * not use this file except in compliance with the License. You may obtain
 * a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the
 * License for the specific language governing permissions and limitations
 * under the License.
 **/

define([
  'intern!object',
  'tests/functional/helpers',
  'tests/functional/real_plugin/plugin_helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal',
  'tests/functional/pages/cluster'
], function(registerSuite, helpers, pluginHelpers, Common, Modal, ClusterPage) {
  'use strict';

  registerSuite(function() {
    var common, modal, clusterPage;

    return {
      name: 'BONDs',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        clusterPage = new ClusterPage(this.remote);

        return this.remote
         .then(function() {
           return common.getIn();
         });
      },
      afterEach: function() {
        return this.remote
          .deleteCluster(modal);
      },
      'Set up attributes': function() {
        return this.remote
         .updatePlugin('update_bonds bond_setup')

         .newClusterWithPlugin(modal);
      },
//      'Test attributes for BOND interfaces provided by plugin': function() {
//        var itfConfigure = 'button.btn-configure-interfaces';
//
//        return this.remote
//          .newClusterWithPlugin(modal)
//
//          // Add one node, open interface configuration
//          .then(function() {
//            return common.addNodesToCluster(1, ['Controller']);
//          })
//          .selectNodeByIndex(0)
//          .clickByCssSelector(itfConfigure)
//
//          // Bond several interfaces and verify that provided attributes are presented for them
//          .bondInterfaces(-1, -2)
//          .assertElementExists('.ifc-list > div:nth-child(1) span.fuel_plugin_example_v5',
//                               'Bonds attributes are not presented')
//
//          // Save changes
//          .applyItfChanges();
//      },
//      'Test Load defaults for BONDs': function() {
//        var itfConfigure = 'button.btn-configure-interfaces';
//
//        return this.remote
//          .newClusterWithPlugin(modal)
//
//          // Add one node, open interface configuration
//          .then(function() {
//            return common.addNodesToCluster(1, ['Controller']);
//          })
//          .selectNodeByIndex(0)
//          .clickByCssSelector(itfConfigure)
//
//          // Bond several interfaces and verify that provided attributes are presented for them
//          .bondInterfaces(-1, -2)
//          .assertElementExists('input[label="bond0"]', 'Bonds was not created')
//          .assertElementExists('.ifc-list > div:nth-child(1) span.fuel_plugin_example_v5',
//                               'Bonds attributes are not presented')
//
//          // Save changes
//          .applyItfChanges()
//
//          // Load Defaults and save changes
//          .clickByCssSelector('button.btn-defaults')
//          .waitForCssSelector('.btn-defaults:not(:disabled)', 1000)
//          .assertElementNotExists('input[label="bond0"]', 'Interfaces were not unbonded')
//          .applyItfChanges();
//      },
      'Test restrictions for Bonds': function() {
        var itfConfigure = 'button.btn-configure-interfaces';
        var bondCheckbox = 'input[type="checkbox"][name="attribute_checkbox"]';
        var bondText = 'input[type="text"][name="attribute_text"]';

        return this.remote
          .updatePlugin('update_bonds bond_restrict')
          .newClusterWithPlugin(modal)

          // Add one node, open interface configuration
          .then(function() {
            return common.addNodesToCluster(1, ['Controller']);
          })
          .selectNodeByIndex(0)
          .clickByCssSelector(itfConfigure)

          // Bond several interfaces and save changes
          .bondInterfaces(-1, -2)
          .assertElementExists('input[label="bond0"]', 'Bonds was not created')
          .applyItfChanges()

          // Check that Checkbox is visible, but Text-input isn't
          .selectPluginNICPropertyByIndex(0).sleep(1000)
          .clickByCssSelector(bondCheckbox)
          .assertElementNotExists(bondText, 'Text-input field is displayed')

          // Enable KVM
          .clickByCssSelector('a.settings.cluster-tab')
          .clickByCssSelector('button.btn-danger.proceed-btn')  // Discard changes
          .then(function() {
            return modal.waitToClose();
          })

          .clickByCssSelector('a.subtab-link-compute')
          .clickByCssSelector('input[name="libvirt_type"][value="kvm"]')

          .clickByCssSelector('button.btn-apply-changes')
          .waitForCssSelector('.btn-load-defaults:not(:disabled)', 1000)

          // Verify that text input is displayed
          .then(function() {
            return clusterPage.goToTab('Nodes');
          })
          .clickByCssSelector(itfConfigure)
          .selectPluginNICPropertyByIndex(0)
          .assertElementExists(bondCheckbox, 'Checkbox is not displayed')
          .assertElementExists(bondText, 'Text-input field is not displayed');
      },
    };
  });
});
