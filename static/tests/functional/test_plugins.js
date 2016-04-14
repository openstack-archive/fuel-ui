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
import SettingsPage from 'tests/functional/pages/settings';
import 'tests/functional/pages/dashboard';

registerSuite(function() {
  var common, clusterPage, settingsPage;
  var clusterName = 'Plugin UI tests';
  var zabbixSectionSelector = '.setting-section-zabbix_monitoring ';

  return {
    name: 'Plugin UI tests',
    setup: function() {
      common = new Common(this.remote);
      clusterPage = new ClusterPage(this.remote);
      settingsPage = new SettingsPage(this.remote);

      return this.remote
        .then(function() {
          return common.getIn();
        })
        .then(function() {
          return common.createCluster(clusterName);
        });
    },
    beforeEach: function() {
      return this.remote
        .then(function() {
          return clusterPage.goToTab('Settings');
        })
        .clickByCssSelector('.subtab-link-other');
    },
    afterEach: function() {
      return this.remote
        .clickByCssSelector('.btn-load-defaults')
        .then(function() {
          return settingsPage.waitForRequestCompleted();
        })
        .clickByCssSelector('.btn-apply-changes')
        .then(function() {
          return settingsPage.waitForRequestCompleted();
        });
    },
    'Check plugin restrictions': function() {
      var loggingSectionSelector = '.setting-section-logging ';
      return this.remote
        // activate Logging plugin
        .clickByCssSelector(loggingSectionSelector + 'h3 input[type=checkbox]')
        // activate Zabbix plugin
        .clickByCssSelector(zabbixSectionSelector + 'h3 input[type=checkbox]')
        .assertElementEnabled(loggingSectionSelector + '[name=logging_text]',
          'No conflict with default Zabix plugin version')
        // change Zabbix plugin version
        .clickByCssSelector(zabbixSectionSelector +
          '.plugin-versions input[type=radio]:not(:checked)')
        .assertElementNotSelected(zabbixSectionSelector + '[name=zabbix_checkbox]',
          'Zabbix checkbox is not activated')
        .clickByCssSelector(zabbixSectionSelector + '[name=zabbix_checkbox]')
        .assertElementDisabled(loggingSectionSelector + '[name=logging_text]',
          'Conflict with Zabbix checkbox')
        // reset changes
        .clickByCssSelector('.btn-revert-changes');
    },
    'Check plugin in not deployed environment': function() {
      var self = this;
      var zabbixInitialVersion, zabbixTextInputValue;
      return this.remote
        .assertElementEnabled(zabbixSectionSelector + 'h3 input[type=checkbox]',
          'Plugin is changeable')
        .assertElementNotSelected(zabbixSectionSelector + 'h3 input[type=checkbox]',
          'Plugin is not actvated')
        .assertElementNotExists(zabbixSectionSelector + '> div input:not(:disabled)',
          'Inactive plugin attributes can not be changes')
        // activate plugin
        .clickByCssSelector(zabbixSectionSelector + 'h3 input[type=checkbox]')
        // save changes
        .clickByCssSelector('.btn-apply-changes')
        .then(function() {
          return settingsPage.waitForRequestCompleted();
        })
        .findByCssSelector(zabbixSectionSelector + '.plugin-versions input[type=radio]:checked')
          .getProperty('value')
            .then(function(value) {
              zabbixInitialVersion = value;
            })
          .end()
        .findByCssSelector(zabbixSectionSelector + '[name=zabbix_text_1]')
          .getProperty('value')
            .then(function(value) {
              zabbixTextInputValue = value;
            })
          .end()
        // change plugin version
        .clickByCssSelector(zabbixSectionSelector +
          '.plugin-versions input[type=radio]:not(:checked)')
        .assertElementPropertyNotEquals(zabbixSectionSelector + '[name=zabbix_text_1]', 'value',
          zabbixTextInputValue, 'Plugin version was changed')
        .assertElementExists('.subtab-link-other .glyphicon-danger-sign',
          'Plugin atributes validation works')
        // fix validation error
        .setInputValue(zabbixSectionSelector + '[name=zabbix_text_with_regex]', 'aa-aa')
        .waitForElementDeletion('.subtab-link-other .glyphicon-danger-sign', 1000)
        .assertElementEnabled('.btn-apply-changes', 'The plugin change can be applied')
        // reset plugin version change
        .clickByCssSelector('.btn-revert-changes')
        .then(function() {
          return self.remote.assertElementPropertyEquals(zabbixSectionSelector +
              '.plugin-versions input[type=radio]:checked', 'value', zabbixInitialVersion,
              'Plugin version change can be reset');
        });
    },
    'Check plugin in deployed environment': function() {
      this.timeout = 100000;
      var self = this;
      var zabbixInitialVersion;
      return this.remote
        .then(function() {
          return common.addNodesToCluster(1, ['Controller']);
        })
        .then(function() {
          return clusterPage.deployEnvironment();
        })
        .then(function() {
          return clusterPage.goToTab('Settings');
        })
        .findByCssSelector(zabbixSectionSelector + '.plugin-versions input[type=radio]:checked')
          .getProperty('value')
            .then(function(value) {
              zabbixInitialVersion = value;
            })
          .end()
        // activate plugin
        .clickByCssSelector(zabbixSectionSelector + 'h3 input[type=checkbox]')
        .assertElementExists(
          zabbixSectionSelector + '.alert-warning',
          'Warning is shown for activated not hot pluggable version'
        )
        .clickByCssSelector(
          zabbixSectionSelector + '.plugin-versions input[type=radio]:not(:checked)'
        )
        .assertElementNotExists(
          zabbixSectionSelector + '.alert-warning',
          'Warning is not shown for activated hot pluggable version'
        )
        // fix validation error
        .setInputValue(zabbixSectionSelector + '[name=zabbix_text_with_regex]', 'aa-aa')
        .waitForElementDeletion('.subtab-link-other .glyphicon-danger-sign', 1000)
        .assertElementEnabled('.btn-apply-changes', 'The plugin change can be applied')
        // deactivate plugin
        .clickByCssSelector(zabbixSectionSelector + 'h3 input[type=checkbox]')
        .then(function() {
          return self.remote.assertElementPropertyEquals(
            zabbixSectionSelector + '.plugin-versions input[type=radio]:checked',
            'value',
            zabbixInitialVersion,
            'Initial plugin version is set for deactivated plugin'
          );
        })
        .assertElementDisabled('.btn-apply-changes', 'The change as reset successfully');
    }
  };
});
