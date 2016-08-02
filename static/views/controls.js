/*
 * Copyright 2014 Mirantis, Inc.
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

/*
 * Copyright (с) 2014 Stephen J. Collings, Matthew Honnibal, Pieter Vanderwerff
 *
 * Based on https://github.com/react-bootstrap/react-bootstrap/blob/master/src/Input.jsx
**/

import $ from 'jquery';
import _ from 'underscore';
import i18n from 'i18n';
import React from 'react';
import ReactDOM from 'react-dom';
import FileSaver from 'file-saver';
import dispatcher from 'dispatcher';
import utils from 'utils';
import {outerClickMixin} from 'component_mixins';

export var Input = React.createClass({
  statics: {
    validate(setting) {
      var error = null;
      if (setting.type === 'number') {
        if (!_.isNumber(setting.value) || _.isNaN(setting.value)) {
          error = i18n('controls.invalid_value');
        } else if (_.isNumber(setting.min) && setting.value < setting.min) {
          error = i18n('controls.number.min_size', {min: setting.min});
        } else if (_.isNumber(setting.max) && setting.value > setting.max) {
          error = i18n('controls.number.max_size', {max: setting.max});
        }
      }
      if (_.isNull(error)) {
        if (
          (setting.regex || {}).source &&
          !String(setting.value).match(new RegExp(setting.regex.source))
        ) {
          error = setting.regex.error;
        }
      }
      return error;
    }
  },
  propTypes: {
    type: React.PropTypes.oneOf([
      'text', 'password', 'textarea', 'checkbox', 'radio',
      'select', 'hidden', 'number', 'range', 'file'
    ]).isRequired,
    name: React.PropTypes.node,
    label: React.PropTypes.node,
    debounce: React.PropTypes.bool,
    description: React.PropTypes.node,
    disabled: React.PropTypes.bool,
    inputClassName: React.PropTypes.node,
    wrapperClassName: React.PropTypes.node,
    tooltipPlacement: React.PropTypes.oneOf(['left', 'right', 'top', 'bottom']),
    tooltipIcon: React.PropTypes.node,
    tooltipText: React.PropTypes.node,
    toggleable: React.PropTypes.bool,
    onChange: React.PropTypes.func,
    extraContent: React.PropTypes.node
  },
  getInitialState() {
    return {
      visible: false,
      fileName: (this.props.defaultValue || {}).name || null,
      content: (this.props.defaultValue || {}).content || null
    };
  },
  getDefaultProps() {
    return {
      type: 'text',
      tooltipIcon: 'glyphicon-warning-sign',
      tooltipPlacement: 'right'
    };
  },
  togglePassword() {
    this.setState({visible: !this.state.visible});
  },
  isCheckboxOrRadio() {
    return this.props.type === 'radio' || this.props.type === 'checkbox';
  },
  getInputDOMNode() {
    return ReactDOM.findDOMNode(this.refs.input);
  },
  debouncedChange: _.debounce(function() {
    return this.onChange();
  }, 200, {leading: true}),
  pickFile() {
    if (!this.props.disabled) {
      this.getInputDOMNode().click();
    }
  },
  saveFile(fileName, content) {
    this.setState({fileName, content});
    return this.props.onChange(this.props.name, {name: fileName, content});
  },
  removeFile() {
    if (!this.props.disabled) {
      ReactDOM.findDOMNode(this.refs.form).reset();
      this.saveFile(null, null);
    }
  },
  readFile() {
    var reader = new FileReader();
    var input = this.getInputDOMNode();
    if (input.files.length) {
      reader.onload = () => this.saveFile(input.value.replace(/^.*[\\\/]/g, ''), reader.result);
      reader.readAsBinaryString(input.files[0]);
    }
  },
  onChange() {
    var {onChange, name, type} = this.props;
    if (onChange) {
      var input = this.getInputDOMNode();
      var value = type === 'checkbox' ? input.checked : input.value;
      if (type === 'number') value = parseInt(value, 10);
      return onChange(name, value);
    }
  },
  handleFocus(e) {
    e.target.select();
  },
  renderFile(input) {
    var {fileName, content} = this.state;
    var {disabled} = this.props;
    return <form ref='form'>
      {input}
      <div className='input-group'>
        <input
          className='form-control file-name'
          type='text'
          placeholder={i18n('controls.file.placeholder')}
          value={fileName ? `[${utils.showSize(content.length)}] ${fileName}` : ''}
          onClick={this.pickFile}
          disabled={disabled}
          readOnly
        />
        <div
          className='input-group-addon'
          onClick={fileName ? this.removeFile : this.pickFile}
        >
          <i
            className={utils.classNames(
              'glyphicon',
              fileName && !disabled ? 'glyphicon-remove-alt' : 'glyphicon-file'
            )}
          />
        </div>
      </div>
    </form>;
  },
  renderInput() {
    var {visible} = this.state;
    var {
      type, value, inputClassName, toggleable, selectOnFocus,
      debounce, children, extraContent
    } = this.props;
    var isFile = type === 'file';
    var isCheckboxOrRadio = this.isCheckboxOrRadio();
    var inputWrapperClasses = {
      'input-group': toggleable,
      'custom-tumbler': isCheckboxOrRadio,
      hidden: type === 'hidden'
    };

    var props = _.extend(
      {},
      this.props,
      {
        ref: 'input',
        key: 'input',
        onFocus: selectOnFocus && this.handleFocus,
        type: (toggleable && visible) ? 'text' : type,
        className: utils.classNames({
          'form-control': type !== 'range',
          [inputClassName]: inputClassName
        }),
        onChange: debounce ? this.debouncedChange : this.onChange
      }
    );

    if (_.has(props, 'value')) {
      props.value = _.isNull(value) || _.isUndefined(value) ? '' : value;
    }

    if (isFile) {
      // File control cannot have any value preset due to
      // security issues. That's why these props should be removed.
      props = _.omit(props, ['defaultValue', 'value']);
      // Value changing handler is needed to calculate and render
      // new control's value in renderFile
      props.onChange = this.readFile;
    }

    var Tag = _.includes(['select', 'textarea'], type) ? type : 'input';
    var input = <Tag {...props}>{children}</Tag>;

    return (
      <div key='input-group' className={utils.classNames(inputWrapperClasses)}>
        {isFile ? this.renderFile(input) : input}
        {toggleable &&
          <div className='input-group-addon' onClick={this.togglePassword}>
            <i
              className={utils.classNames(
                'glyphicon',
                visible ? 'glyphicon-eye-close' : 'glyphicon-eye-open'
              )}
            />
          </div>
        }
        {isCheckboxOrRadio && <span>&nbsp;</span>}
        {extraContent}
      </div>
    );
  },
  renderLabel(children) {
    var {label, id, tooltipText, tooltipPlacement, tooltipIcon} = this.props;
    if (!label && !children) return null;
    return (
      <label key='label' htmlFor={id}>
        {children}
        <span>{label}</span>
        {tooltipText &&
          <Tooltip text={tooltipText} placement={tooltipPlacement}>
            <i className={utils.classNames('glyphicon tooltip-icon', tooltipIcon)} />
          </Tooltip>
        }
      </label>
    );
  },
  renderDescription() {
    var {error, description} = this.props;
    return (
      <span key='description' className='help-block'>
        {!_.isUndefined(error) && !_.isNull(error) ? error : description || ''}
      </span>
    );
  },
  renderWrapper(children) {
    var {error, disabled, wrapperClassName} = this.props;
    var isCheckboxOrRadio = this.isCheckboxOrRadio();
    var classes = {
      'form-group': !isCheckboxOrRadio,
      'checkbox-group': isCheckboxOrRadio,
      'has-error': !_.isUndefined(error) && !_.isNull(error),
      disabled,
      [wrapperClassName]: wrapperClassName
    };
    return <div className={utils.classNames(classes)}>{children}</div>;
  },
  render() {
    if (this.props.type === 'hidden' && !this.props.description && !this.props.label) return null;
    return this.renderWrapper(
      this.isCheckboxOrRadio() ? [
        this.renderLabel(this.renderInput()),
        this.renderDescription()
      ] : [
        this.renderLabel(),
        this.renderInput(),
        this.renderDescription()
      ]
    );
  }
});

export var RadioGroup = React.createClass({
  propTypes: {
    name: React.PropTypes.string,
    values: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    label: React.PropTypes.node,
    tooltipText: React.PropTypes.node
  },
  render() {
    var {label, tooltipText, values} = this.props;
    return (
      <div className='radio-group'>
        {label &&
          <h4>
            {label}
            {tooltipText &&
              <Tooltip text={tooltipText} placement='right'>
                <i className='glyphicon glyphicon-warning-sign tooltip-icon' />
              </Tooltip>
            }
          </h4>
        }
        {_.map(values,
          (value) => <Input
            {...this.props}
            {...value}
            type='radio'
            key={value.data}
            value={value.data}
          />
        )}
      </div>
    );
  }
});

export var ProgressBar = React.createClass({
  propTypes: {
    wrapperClassName: React.PropTypes.node,
    progress: React.PropTypes.number
  },
  render() {
    var wrapperClasses = {
      progress: true
    };
    wrapperClasses[this.props.wrapperClassName] = this.props.wrapperClassName;

    var isInfinite = !_.isNumber(this.props.progress);
    var progressClasses = {
      'progress-bar': true,
      'progress-bar-striped active': isInfinite
    };

    return (
      <div className={utils.classNames(wrapperClasses)}>
        <div
          className={utils.classNames(progressClasses)}
          role='progressbar'
          style={{width: isInfinite ? '100%' : _.max([this.props.progress, 3]) + '%'}}
        >
          {!isInfinite && this.props.progress + '%'}
        </div>
      </div>
    );
  }
});

export var ProgressButton = React.createClass({
  propTypes: {
    progress: React.PropTypes.bool
  },
  render() {
    var {children, className, progress} = this.props;
    var classNames = utils.classNames({
      [className]: true,
      'btn-progress': progress
    });
    return <button
      {...this.props}
      className={classNames}
    >
      {children}
    </button>;
  }
});

export var Table = React.createClass({
  propTypes: {
    tableClassName: React.PropTypes.node,
    head: React.PropTypes.array,
    body: React.PropTypes.array
  },
  render() {
    var tableClasses = {'table table-bordered': true, 'table-striped': !this.props.noStripes};
    tableClasses[this.props.tableClassName] = this.props.tableClassName;
    return (
      <table className={utils.classNames(tableClasses)}>
        <thead>
          <tr>
            {_.map(this.props.head, (column, index) => {
              var classes = {};
              classes[column.className] = column.className;
              return <th key={index} className={utils.classNames(classes)}>{column.label}</th>;
            })}
          </tr>
        </thead>
        <tbody>
          {_.map(this.props.body, (row, rowIndex) => {
            return <tr key={rowIndex}>
              {_.map(row, (column, columnIndex) => {
                return <td key={columnIndex} className='enable-selection'>{column}</td>;
              })}
            </tr>;
          })}
        </tbody>
      </table>
    );
  }
});

export var Popover = React.createClass({
  mixins: [outerClickMixin],
  propTypes: {
    className: React.PropTypes.node,
    placement: React.PropTypes.node
  },
  getDefaultProps() {
    return {placement: 'bottom'};
  },
  render() {
    var classes = {'popover in': true};
    classes[this.props.placement] = true;
    classes[this.props.className] = true;
    return (
      <div className={utils.classNames(classes)}>
        <div className='arrow' />
        <div className='popover-content'>{this.props.children}</div>
      </div>
    );
  }
});

export var Tooltip = React.createClass({
  propTypes: {
    container: React.PropTypes.node,
    placement: React.PropTypes.node,
    text: React.PropTypes.node,
    wrap: React.PropTypes.bool // wraps tooltip target element into div.tooltip-wrapper
  },
  getDefaultProps() {
    return {
      placement: 'top',
      container: 'body',
      wrapperClassName: 'tooltip-wrapper'
    };
  },
  componentDidMount() {
    if (this.props.text) this.addTooltip();
  },
  componentDidUpdate() {
    if (this.props.text) {
      this.updateTooltipTitle();
    } else {
      this.removeTooltip();
    }
  },
  componentWillUnmount() {
    this.removeTooltip();
  },
  addTooltip() {
    $(ReactDOM.findDOMNode(this.refs.tooltip)).tooltip({
      container: this.props.container,
      placement: this.props.placement,
      title: this.props.text
    });
  },
  updateTooltipTitle() {
    $(ReactDOM.findDOMNode(this.refs.tooltip)).attr('title', this.props.text).tooltip('fixTitle');
  },
  removeTooltip() {
    $(ReactDOM.findDOMNode(this.refs.tooltip)).tooltip('destroy');
  },
  render() {
    if (!this.props.wrap) {
      return React.cloneElement(React.Children.only(this.props.children), {ref: 'tooltip'});
    }
    return (
      <div className={this.props.wrapperClassName} ref='tooltip'>
        {this.props.children}
      </div>
    );
  }
});

export var MultiSelectControl = React.createClass({
  propTypes: {
    name: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.bool]),
    options: React.PropTypes.arrayOf(React.PropTypes.object).isRequired,
    values: React.PropTypes.arrayOf(
      React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.bool])
    ),
    label: React.PropTypes.node.isRequired,
    dynamicValues: React.PropTypes.bool,
    onChange: React.PropTypes.func,
    extraContent: React.PropTypes.node,
    toggle: React.PropTypes.func.isRequired,
    isOpen: React.PropTypes.bool.isRequired,
    addOptionsFilter: React.PropTypes.bool
  },
  getInitialState() {
    return {
      optionsFilter: null
    };
  },
  getDefaultProps() {
    return {
      values: [],
      isOpen: false,
      addOptionsFilter: false,
      optionsNumberToShowFilter: 10
    };
  },
  onChange(name, checked, isLabel = false) {
    var {options, values, onChange, dynamicValues} = this.props;
    if (!dynamicValues) {
      onChange(
        name === 'all' ?
          checked ? _.map(this.getFilteredOptions(), 'name') : []
        :
          (checked ? _.union : _.difference)(values, [name])
      );
    } else {
      onChange(_.find(options, {name, isLabel}));
    }
  },
  closeOnEscapeKey(e) {
    if (e.key === 'Escape') this.props.toggle(false);
  },
  setOptionsFilter(name, value) {
    this.setState({optionsFilter: value.trim().toLowerCase() || null});
  },
  getFilteredOptions() {
    var {optionsFilter} = this.state;
    if (!_.isNull(optionsFilter)) {
      return _.filter(this.props.options,
        (option) => _.startsWith((option.title || '').toLowerCase(), optionsFilter)
      );
    }
    return this.props.options;
  },
  getLabel() {
    var {label, options, values, dynamicValues} = this.props;
    if (!dynamicValues && values.length) {
      return label + ': ' + (
        values.length > 3 ?
          i18n('controls.selected_options', {count: values.length})
        :
          _.map(values, (name) => _.find(options, {name}).title).join(', ')
      );
    }
    return label;
  },
  render() {
    var {
      values, dynamicValues, isOpen, className, toggle, extraContent,
      addOptionsFilter, optionsNumberToShowFilter
    } = this.props;

    if (!this.props.options.length) return null;

    var options = this.getFilteredOptions();
    var attributes, labels;
    if (dynamicValues) {
      var groupedOptions = _.groupBy(options, 'isLabel');
      attributes = groupedOptions.false || [];
      labels = groupedOptions.true || [];
    }

    var optionProps = (option) => ({
      key: option.name,
      ref: option.name,
      type: 'checkbox',
      name: option.name,
      label: option.title,
      checked: _.includes(values, option.name),
      onChange: this.onChange
    });

    return (
      <div
        className={utils.classNames({
          'btn-group multiselect': true,
          [className]: true,
          open: isOpen,
          'more-control': dynamicValues
        })}
        tabIndex='-1'
        onKeyDown={this.closeOnEscapeKey}
      >
        <button
          className={utils.classNames(
            'btn dropdown-toggle',
            (dynamicValues && !isOpen) ? 'btn-link' : 'btn-default'
          )}
          onClick={toggle}
        >
          {this.getLabel()} <span className='caret' />
        </button>
        {isOpen &&
          <Popover toggle={toggle}>
            {addOptionsFilter && this.props.options.length >= optionsNumberToShowFilter &&
              <Input
                type='text'
                ref='optionsFilter'
                name='optionsFilter'
                onChange={this.setOptionsFilter}
                wrapperClassName='options-filter'
                placeholder={i18n('controls.find_options_placeholder')}
                debounce
              />
            }
            {!dynamicValues ?
              <div>
                {!!options.length &&
                  <div>
                    <Input
                      type='checkbox'
                      ref='all'
                      label={i18n('controls.select_all')}
                      name='all'
                      checked={values.length === options.length}
                      onChange={this.onChange}
                      wrapperClassName='select-all-options'
                    />
                    <div key='divider' className='divider' />
                  </div>
                }
                {_.map(options, (option) => <Input {...optionProps(option)} />)}
              </div>
            :
              <div>
                {_.map(attributes, (option) => <Input {...optionProps(option)} />)}
                {!!attributes.length && !!labels.length &&
                  <div key='divider' className='divider' />
                }
                {_.map(labels,
                  (option) => <Input
                    {...optionProps(option)}
                    key={'label-' + option.name}
                    onChange={_.partialRight(this.onChange, true)}
                  />
                )}
              </div>
            }
          </Popover>
        }
        {extraContent}
      </div>
    );
  }
});

export var Link = React.createClass({
  propTypes: {
    to: React.PropTypes.string.isRequired
  },
  render() {
    var {to, children} = this.props;
    to = to.replace(/^\//, '#');
    return <a href={to} {... _.omit(this.props, ['to'])}>{children}</a>;
  }
});

export var ScreenTransitionWrapper = React.createClass({
  componentWillEnter(cb) {
    $(ReactDOM.findDOMNode(this)).hide().delay('fast').fadeIn('fast', cb);
  },
  componentWillLeave(cb) {
    $(ReactDOM.findDOMNode(this)).fadeOut('fast', cb);
  },
  render() {
    if (this.props.loading) {
      return (
        <div className='row'>
          <div className='col-xs-12'>
            <ProgressBar wrapperClassName='screen-loading-bar' />
          </div>
        </div>
      );
    }
    return <div>{this.props.children}</div>;
  }
});

export var DownloadFileButton = React.createClass({
  propTypes: {
    label: React.PropTypes.string.isRequired,
    fileName: React.PropTypes.string.isRequired,
    fileType: React.PropTypes.oneOf(['json', 'csv']),
    fileContent: React.PropTypes.func,
    url: React.PropTypes.string,
    urlData: React.PropTypes.object,
    className: React.PropTypes.string
  },
  getDefaultProps() {
    return {
      fileType: 'json',
      urlData: {}
    };
  },
  downloadFile() {
    var {url, urlData, fileType, fileContent} = this.props;
    if (url) {
      dispatcher.trigger('pageLoadStarted');
      $.ajax({
        url,
        data: urlData,
        dataType: {json: 'json', csv: 'text'}[fileType],
        headers: {'X-Auth-Token': app.keystoneClient.token}
      })
      .then(
        (response) => this.saveFile(response),
        (response) => utils.showErrorDialog({
          title: i18n('dialog.file_download_error.title'),
          response
        })
      )
      .then(() => dispatcher.trigger('pageLoadFinished'));
    } else {
      this.saveFile(fileContent());
    }
  },
  saveFile(fileContent) {
    var {fileType, fileName} = this.props;
    var processors = {
      json: (data) => JSON.stringify(data, null, 2),
      csv: _.identity
    };
    var blob = new Blob(
      [processors[fileType](fileContent)],
      {
        type: {json: 'application/json', csv: 'text/csv'}[fileType]
      }
    );
    FileSaver.saveAs(blob, fileName);
  },
  render() {
    var {label, className} = this.props;
    return (
      <button
        className={utils.classNames('btn btn-default', className)}
        onClick={this.downloadFile}
      >
        {label}
      </button>
    );
  }
});
