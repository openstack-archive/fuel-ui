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
      'Test compatible murano, incompatible ironic, requires sahara': function() {
      // https://mirantis.testrail.com/index.php?/cases/view/842448

        return this.remote
          .pressKeys('\uE007')  // go to Compute
          .pressKeys('\uE007')  // Networking
          .pressKeys('\uE007')  // Storage
          .pressKeys('\uE007')  // Additional Services

          // Check that smile is disabled when Sahara is not enabled (by default)
          .assertElementDisabled('input[value=additional_service\\:smile]',
                                 'Smile is enabled with Sahara')

          // Check that smile is not compatible with Ironic
          .clickByCssSelector('input[value=additional_service\\:sahara]')  // enable required Sahara
          .clickByCssSelector('input[value=additional_service\\:ironic]')
          .assertElementDisabled('input[value=additional_service\\:smile]',
                                 'Smile is enabled with Ironic')
          .clickByCssSelector('input[value=additional_service\\:ironic]')  // disable Ironic
          .clickByCssSelector('input[value=additional_service\\:smile]')
          .assertElementDisabled('input[value=additional_service\\:ironic]',
                                 'Ironic is enabled with smile')
          .assertElementExists('i.tooltip-icon.glyphicon-warning-sign[data-reactid*="ironic"]'+
                               '[data-original-title="Not compatible with smile"]')

          // Create cluster with smile + Sahara
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
