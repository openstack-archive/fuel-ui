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

var ns = 'cluster_page.nodes_tab.configure_interfaces.offloading.';

var OffloadingModesControl = React.createClass({
  propTypes: {
    attributes: React.PropTypes.object,
    offloadingModes: React.PropTypes.array
  },
  setModeState({name, sub}, state, recursive = true) {
    var {attributes, onChange} = this.props;
    var offloadingModeStates = _.cloneDeep(attributes.get('offloading.modes.value'));
    offloadingModeStates[name] = state;
    attributes.set('offloading.modes.value', offloadingModeStates);
    if (onChange) onChange();
    if (recursive) _.each(sub, (mode) => this.setModeState(mode, state));
  },
  checkModes(mode, sub) {
    // process children first
    var offloadingModeStates = this.props.attributes.get('offloading.modes.value');
    _.each(sub, (childMode) => {
      this.checkModes(childMode, childMode.sub);
    });

    // root node or leaf node
    if (_.isNull(mode) || !sub.length) return;

    // Case 1. all children disabled - parent go disabled
    if (_.every(sub, ({name}) => offloadingModeStates[name] === false)) {
      this.setModeState(mode, false, false);
    }

    // Case 2. any child is default and parent is disabled - parent go default
    var parentModeState = offloadingModeStates[mode.name];
    if (
      parentModeState === false &&
      _.some(sub, ({name}) => offloadingModeStates[name] === null)
    ) this.setModeState(mode, null, false);
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
    var {offloadingModes} = this.props;
    var mode = this.findMode(name, offloadingModes);

    return () => {
      if (mode) {
        this.setModeState(mode, state);
        this.checkModes(null, offloadingModes);
      } else {
        // handle All Modes click
        _.each(offloadingModes, (mode) => this.setModeState(mode, state));
      }
    };
  },
  renderChildModes(modes, level) {
    var {offloadingModes, attributes, disabled} = this.props;
    var offloadingModeStates = attributes.get('offloading.modes.value');
    return modes.map(({name, sub}) => {
      var lines = [
        <tr key={name} className={'level' + level}>
          <td>{i18n(ns + name, {defaultValue: name})}</td>
          {[true, false, null].map((modeState) => {
            var state = name === 'all_modes' ?
              _.uniq(_.map(offloadingModes, ({name}) => offloadingModeStates[name])).length === 1 ?
                offloadingModeStates[offloadingModes[0].name] : undefined
            :
              offloadingModeStates[name];
            return (
              <td key={name + modeState}>
                <button
                  className={utils.classNames({
                    'btn-link': true,
                    active: state === modeState
                  })}
                  disabled={disabled}
                  onClick={this.onModeStateChange(name, modeState)}>
                  <i className='glyphicon glyphicon-ok' />
                </button>
              </td>
            );
          })}
        </tr>
      ];
      if (sub) return _.union([lines, this.renderChildModes(sub, level + 1)]);
      return lines;
    });
  },
  render() {
    var offloadingModes = [{name: 'all_modes', sub: this.props.offloadingModes}];
    return (
      <div className='offloading-modes'>
        <table className='table'>
          <thead>
            <tr>
              <th>{i18n(ns + 'offloading_mode')}</th>
              <th>{i18n('common.enabled')}</th>
              <th>{i18n('common.disabled')}</th>
              <th>{i18n('common.default')}</th>
            </tr>
          </thead>
          <tbody>
          {this.renderChildModes(offloadingModes, 1)}
          </tbody>
        </table>
      </div>
    );
  }
});

export default OffloadingModesControl;
