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
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import utils from 'utils';

var ns = 'cluster_page.nodes_tab.configure_interfaces.';

var OffloadingModesControl = React.createClass({
  propTypes: {
    attributes: React.PropTypes.object,
    offloadingModesMeta: React.PropTypes.array
  },
  setModeState(mode, state, recursive = true) {
    var attributes = this.props.attributes;
    var modeStates = _.cloneDeep(attributes.get('offloading.modes.value'));
    modeStates[mode.name] = state;
    attributes.set('offloading.modes.value', modeStates);
    if (recursive) {
      _.each(mode.sub, (mode) => this.setModeState(mode, state));
    }
  },
  checkModes(mode, sub) {
    // process children first
    var modeStates = this.props.attributes.get('offloading.modes.value');
    _.each(sub, (childMode) => {
      this.checkModes(childMode, childMode.sub);
    });

    // root node or leaf node
    if (mode === null || sub.length === 0) {
      return;
    }

    // Case 1. all children disabled - parent go disabled
    if (_.every(sub, (childMode) => modeStates[childMode.name] === false)) {
      this.setModeState(mode, false, false);
    }

    // Case 2. any child is default and parent is disabled - parent go default
    var parentModeState = modeStates[mode.name];
    if (parentModeState === false &&
        _.some(sub, (childMode) => modeStates[childMode.name] === null)) {
      this.setModeState(mode, null, false);
    }
  },
  findMode(name, modes) {
    var result, mode;
    var index = 0;
    var modesLength = modes.length;
    for (; index < modesLength; index++) {
      mode = modes[index];
      if (mode.name === name) {
        return mode;
      } else if (!_.isEmpty(mode.sub)) {
        result = this.findMode(name, mode.sub);
        if (result) {
          break;
        }
      }
    }
    return result;
  },
  onModeStateChange(name, state) {
    var modes = this.props.offloadingModesMeta || [];
    var mode = this.findMode(name, modes);

    return () => {
      if (mode) {
        this.setModeState(mode, state);
        this.checkModes(null, modes);
      } else {
        // handle All Modes click
        _.each(modes, (mode) => this.setModeState(mode, state));
      }
    };
  },
  renderChildModes(modes, level) {
    var offloadingModesMeta = this.props.offloadingModesMeta;
    var modeStates = this.props.attributes.get('offloading.modes.value');
    return modes.map((mode) => {
      var lines = [
        <tr key={mode.name} className={'level' + level}>
          <td>{mode.name}</td>
          {[true, false, null].map((modeState) => {
            var state = modeStates[mode.name];
            if (mode.name === i18n(ns + 'all_modes')) {
              state = _.uniq(_.map(offloadingModesMeta,
                (mode) => modeStates[mode.name])).length === 1 ?
                  modeStates[offloadingModesMeta[0].name] : undefined;
            }
            var styles = {
              'btn-link': true,
              active: state === modeState
            };
            return (
              <td key={mode.name + modeState}>
                <button
                  className={utils.classNames(styles)}
                  disabled={this.props.disabled}
                  onClick={this.onModeStateChange(mode.name, modeState)}>
                  <i className='glyphicon glyphicon-ok'></i>
                </button>
              </td>
            );
          })}
        </tr>
      ];
      if (mode.sub) {
        return _.union([lines, this.renderChildModes(mode.sub, level + 1)]);
      }
      return lines;
    });
  },
  render() {
    var modes = [];
    var offloadingModesMeta = this.props.offloadingModesMeta;
    if (offloadingModesMeta) {
      modes.push({
        name: i18n(ns + 'all_modes'),
        sub: offloadingModesMeta
      });
    }

    return (
      <div className='offloading-modes'>
        <table className='table'>
          <thead>
            <tr>
              <th>{i18n(ns + 'offloading_mode')}</th>
              <th>{i18n('common.enabled')}</th>
              <th>{i18n('common.disabled')}</th>
              <th>{i18n(ns + 'offloading_default')}</th>
            </tr>
          </thead>
          <tbody>
          {this.renderChildModes(modes, 1)}
          </tbody>
        </table>
      </div>
    );
  }
});

export default OffloadingModesControl;
