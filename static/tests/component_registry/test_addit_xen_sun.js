/*
 * Copyright 2015 Mirantis, Inc.
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
  'intern/chai!assert',
  'tests/functional/helpers',
  'tests/functional/pages/common',
  'tests/functional/pages/modal'
], function(registerSuite, assert, helpers, Common, Modal) {
  'use strict';

  registerSuite(function() {
    var common, modal;

    return {
      name: 'Wizard Page',
      setup: function() {
        common = new Common(this.remote);
        modal = new Modal(this.remote);
        return this.remote
          .then(function() {
            return common.getIn();
          });
      },
      beforeEach: function() {
        var clusterName = common.pickRandomName('Temp');
        return this.remote
          .clickByCssSelector('.create-cluster')
          .then(function() {
            return modal.waitToOpen();
          })
          .setInputValue('[name=name]', clusterName);
      },
      'Test compatible ceilometer, incompatible hypervisor:libvirt:*, requires murano': function() {
      // https://mirantis.testrail.com/index.php?/cases/view/842449

        return this.remote
          .pressKeys('\uE007')  // go to Compute

          // Check that xen is not compatible with sun and rain hypervisors
          .clickByCssSelector('input[value=hypervisor\\:test\\:sun]')
          .assertElementDisabled('input[value=hypervisor\\:xen]',
                                 'Xen checkbox is enabled with sun').sleep(100)
          .clickByCssSelector('input[value=hypervisor\\:test\\:rain]')
          .assertElementDisabled('input[value=hypervisor\\:xen]',
                                 'Xen checkbox is enabled with sun + rain').sleep(100)
          .clickByCssSelector('input[value=hypervisor\\:test\\:sun]')
          .assertElementDisabled('input[value=hypervisor\\:xen]',
                                 'Xen checkbox is enabled with rain').sleep(100)
          .clickByCssSelector('input[value=hypervisor\\:test\\:rain]')

          .clickByCssSelector('input[value=hypervisor\\:xen]')
          .assertElementDisabled('input[value=hypervisor\\:test\\:sun]',
                                 'Sun checkbox is enabled with xen').sleep(100)
          .assertElementDisabled('input[value=hypervisor\\:test\\:rain]',
                                 'Rain checkbox is enabled with xen').sleep(100)
          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="sun"]').sleep(100)
          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="rain"]').sleep(100)

          // Try to create cluster with xen without Murano
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToOpen().sleep(50);
          })
          .assertElementTextEquals('div.text-error', 'Requires [u\'additional_service:murano\'] for '+
                                   '\'hypervisor:xen\' components were not satisfied.',
                                   'Error were not displayed')
          .then(function() {
            return modal.close();
          })
      },
      'Test create cluster with xen+Murano+Ceilometer': function() {
        return this.remote
          // Create cluster with xen + Murano + Ceilometer
          .pressKeys('\uE007')  // go to Compute
          .clickByCssSelector('input[value=hypervisor\\:xen]')
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services
          .clickByCssSelector('input[value=additional_service\\:murano]')
          .clickByCssSelector('input[value=additional_service\\:ceilometer]')
          .pressKeys('\uE007')  // Finish
          .pressKeys('\uE007')  // Create
          .then(function() {
            return modal.waitToOpen().sleep(50);
          })

          // Delete created environment
          .clickByCssSelector('button.delete-environment-btn')
          .clickByCssSelector('button.remove-cluster-btn');
      }
    };
  });
});
