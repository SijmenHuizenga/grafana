import { css } from '@emotion/css';
import debounce from 'debounce-promise';
import React, { PureComponent } from 'react';

import { FeatureState, SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, reportInteraction } from '@grafana/runtime';
import { Preferences as UserPreferencesDTO } from '@grafana/schema/src/raw/preferences/x/preferences_types.gen';
import {
  Button,
  Field,
  FieldSet,
  Form,
  Label,
  RadioButtonGroup,
  Select,
  stylesFactory,
  TimeZonePicker,
  WeekStartPicker,
  FeatureBadge,
  AutoSaveField,
  TextArea,
  AsyncSelect,
  Checkbox,
  Switch,
} from '@grafana/ui';
import { DashboardPicker } from 'app/core/components/Select/DashboardPicker';
import { t, Trans } from 'app/core/internationalization';
import { LANGUAGES } from 'app/core/internationalization/constants';
import { PreferencesService } from 'app/core/services/PreferencesService';
import { backendSrv } from 'app/core/services/backend_srv';
import { DashboardSearchItem } from 'app/features/search/types';

export interface Props {
  resourceUri: string;
  disabled?: boolean;
  preferenceType: 'org' | 'team' | 'user';
  onConfirm?: () => Promise<boolean>;
}

export type State = UserPreferencesDTO;

function getLanguageOptions(): Array<SelectableValue<string>> {
  const languageOptions = LANGUAGES.map((v) => ({
    value: v.code,
    label: v.name,
  }));

  const options = [
    {
      value: '',
      label: t('common.locale.default', 'Default'),
    },
    ...languageOptions,
  ];

  return options;
}

const i18nFlag = Boolean(config.featureToggles.internationalization);

export class SharedPreferences extends PureComponent<Props, State> {
  service: PreferencesService;
  themeOptions: SelectableValue[];

  constructor(props: Props) {
    super(props);

    this.service = new PreferencesService(props.resourceUri);
    this.state = {
      theme: '',
      timezone: '',
      weekStart: '',
      language: '',
      queryHistory: { homeTab: '' },
    };

    this.themeOptions = [
      { value: '', label: t('shared-preferences.theme.default-label', 'Default') },
      { value: 'dark', label: t('shared-preferences.theme.dark-label', 'Dark') },
      { value: 'light', label: t('shared-preferences.theme.light-label', 'Light') },
      { value: 'system', label: t('shared-preferences.theme.system-label', 'System') },
    ];
  }

  async componentDidMount() {
    const prefs = await this.service.load();

    this.setState({
      homeDashboardUID: prefs.homeDashboardUID,
      theme: prefs.theme,
      timezone: prefs.timezone,
      weekStart: prefs.weekStart,
      language: prefs.language,
      queryHistory: prefs.queryHistory,
    });
  }

  onSubmitForm = async () => {
    const confirmationResult = this.props.onConfirm ? await this.props.onConfirm() : true;

    if (confirmationResult) {
      const { homeDashboardUID, theme, timezone, weekStart, language, queryHistory } = this.state;
      await this.service.update({ homeDashboardUID, theme, timezone, weekStart, language, queryHistory });
      window.location.reload();
    }
  };

  onSubmitFormAutoSave = async () => {
    const { homeDashboardUID, theme, timezone, weekStart, language, queryHistory } = this.state;
    await this.service.update({ homeDashboardUID, theme, timezone, weekStart, language, queryHistory });
  };

  onThemeChanged = (value: string) => {
    this.setState({ theme: value });
  };

  onTimeZoneChanged = (timezone?: string) => {
    if (!timezone) {
      return;
    }
    this.setState({ timezone: timezone });
  };

  onWeekStartChanged = (weekStart: string) => {
    this.setState({ weekStart: weekStart });
  };

  onHomeDashboardChanged = (dashboardUID: string) => {
    this.setState({ homeDashboardUID: dashboardUID });
  };

  onLanguageChanged = (language: string) => {
    this.setState({ language });

    reportInteraction('grafana_preferences_language_changed', {
      toLanguage: language,
      preferenceType: this.props.preferenceType,
    });
  };

  onCheckedChanged = (event: React.FormEvent<HTMLInputElement>) => {
    const newValues = event.currentTarget.checked;
    console.log(newValues);
  };
  formatLabelGeneral = (folderTitle = 'General', dashboardTitle: string) => `${folderTitle}/${dashboardTitle}`;

  findDashboards = async (query = '') => {
    return backendSrv.search({ type: 'dash-db', query, limit: 100 }).then((result: DashboardSearchItem[]) => {
      return result.map((item: DashboardSearchItem) => ({
        value: {
          // dashboards uid here is always defined as this endpoint does not return the default home dashboard
          uid: item.uid!,
          title: item.title,
          folderTitle: item.folderTitle,
          folderUid: item.folderUid,
        },
        label: this.formatLabelGeneral(item?.folderTitle, item.title),
      }));
    });
  };

  getDashboards = debounce(this.findDashboards, 250, { leading: true });

  render() {
    const { theme, timezone, weekStart, homeDashboardUID, language } = this.state;
    const { disabled } = this.props;
    const styles = getStyles();
    const languages = getLanguageOptions();
    let currentThemeOption = this.themeOptions[0].value;
    if (theme?.length) {
      currentThemeOption = this.themeOptions.find((item) => item.value === theme)?.value;
    }

    return (
      <div>
        <FieldSet label={'Testing AutoSaveField'} disabled={disabled}>
          <AutoSaveField
            label={
              <Label htmlFor="home-dashboard-select">
                <span className={styles.labelText}>
                  <Trans i18nKey="shared-preferences.fields.home-dashboard-label">Select test</Trans>
                </span>
              </Label>
            }
            data-testid="User preferences home dashboard drop down"
            onFinishChange={this.onSubmitFormAutoSave}
          >
            {(onChange) => (
              <AsyncSelect
                loadOptions={this.getDashboards}
                value={homeDashboardUID}
                onChange={(v) => {
                  const { uid } = v?.value;
                  onChange(uid ?? '');
                  this.onHomeDashboardChanged(uid ?? '');
                }}
                defaultOptions={true}
                isClearable={true}
                placeholder={t('shared-preferences.fields.home-dashboard-placeholder', 'Default dashboard')}
                inputId="home-dashboard-select"
              />
            )}
          </AutoSaveField>
          <AutoSaveField
            label={t('shared-preferences.fields.theme-label', 'Test RadioButtonGroup')}
            onFinishChange={this.onSubmitForm}
          >
            {(onChange) => (
              <RadioButtonGroup
                options={this.themeOptions}
                value={currentThemeOption}
                onChange={(v) => {
                  onChange(v);
                  this.onThemeChanged(v);
                }}
              />
            )}
          </AutoSaveField>
          <AutoSaveField
            label={t('shared-preferences.fields.week-start-label', 'Test TextArea')}
            data-testid={selectors.components.WeekStartPicker.containerV2}
            onFinishChange={this.onSubmitFormAutoSave}
          >
            {(onChange) => (
              <TextArea
                aria-label="message"
                value={weekStart || ''}
                onChange={(v) => {
                  onChange(v.currentTarget.value);
                  this.onWeekStartChanged(v.currentTarget.value);
                }}
                placeholder="Add a note to describe your changes."
                autoFocus
                rows={5}
              />
            )}
          </AutoSaveField>
          <AutoSaveField
            label={t('shared-preferences.fields.week-start-label', 'Test Checkbox')}
            data-testid={selectors.components.WeekStartPicker.containerV2}
            onFinishChange={this.onSubmitFormAutoSave}
          >
            {(onChange) => {
              const isCheckedDefault = theme === '';
              const isCheckedDark = theme === 'dark';
              const isCheckedLight = theme === 'light';
              const isCheckedSystem = theme === 'system';
              return (
                <>
                  <Checkbox
                    label={'Default'}
                    value={isCheckedDefault}
                    onChange={() => {
                      this.onThemeChanged('');
                      onChange('');
                    }}
                  />
                  <Checkbox
                    label={'Dark'}
                    value={isCheckedDark}
                    onChange={() => {
                      this.onThemeChanged('dark');
                      onChange('dark');
                    }}
                  />
                  <Checkbox
                    label={'Light'}
                    value={isCheckedLight}
                    onChange={() => {
                      this.onThemeChanged('light');
                      onChange('light');
                    }}
                  />
                  <Checkbox
                    label={'System'}
                    value={isCheckedSystem}
                    onChange={(v) => {
                      this.onThemeChanged('system');
                      onChange('system');
                    }}
                  />
                </>
              );
            }}
          </AutoSaveField>
          <AutoSaveField
            label={t('shared-preferences.fields.week-start-label', 'Test Switch: dark = on | light = off')}
            data-testid={selectors.components.WeekStartPicker.containerV2}
            onFinishChange={this.onSubmitFormAutoSave}
          >
            {(onChange) => (
              <Switch
                value={theme === 'dark' ? true : false}
                onChange={(e) => {
                  e.currentTarget.checked && this.onThemeChanged('dark');
                  !e.currentTarget.checked && this.onThemeChanged('light');
                  onChange(e.currentTarget.value);
                }}
              />
            )}
          </AutoSaveField>
        </FieldSet>
        <Form onSubmit={this.onSubmitForm}>
          {() => {
            return (
              <FieldSet label={<Trans i18nKey="shared-preferences.title">Preferences</Trans>} disabled={disabled}>
                <Field label={t('shared-preferences.fields.theme-label', 'UI Theme')}>
                  <RadioButtonGroup
                    options={this.themeOptions}
                    value={currentThemeOption}
                    onChange={this.onThemeChanged}
                  />
                </Field>

                <Field
                  label={
                    <Label htmlFor="home-dashboard-select">
                      <span className={styles.labelText}>
                        <Trans i18nKey="shared-preferences.fields.home-dashboard-label">Home Dashboard</Trans>
                      </span>
                    </Label>
                  }
                  data-testid="User preferences home dashboard drop down"
                >
                  <DashboardPicker
                    value={homeDashboardUID}
                    onChange={(v) => this.onHomeDashboardChanged(v?.uid ?? '')}
                    defaultOptions={true}
                    isClearable={true}
                    placeholder={t('shared-preferences.fields.home-dashboard-placeholder', 'Default dashboard')}
                    inputId="home-dashboard-select"
                  />
                </Field>

                <Field
                  label={t('shared-dashboard.fields.timezone-label', 'Timezone')}
                  data-testid={selectors.components.TimeZonePicker.containerV2}
                >
                  <TimeZonePicker
                    includeInternal={true}
                    value={timezone}
                    onChange={this.onTimeZoneChanged}
                    inputId="shared-preferences-timezone-picker"
                  />
                </Field>

                <Field
                  label={t('shared-preferences.fields.week-start-label', 'Week start')}
                  data-testid={selectors.components.WeekStartPicker.containerV2}
                >
                  <WeekStartPicker
                    value={weekStart || ''}
                    onChange={this.onWeekStartChanged}
                    inputId={'shared-preferences-week-start-picker'}
                  />
                </Field>

                {i18nFlag ? (
                  <Field
                    label={
                      <Label htmlFor="locale-select">
                        <span className={styles.labelText}>
                          <Trans i18nKey="shared-preferences.fields.locale-label">Language</Trans>
                        </span>
                        <FeatureBadge featureState={FeatureState.beta} />
                      </Label>
                    }
                    data-testid="User preferences language drop down"
                  >
                    <Select
                      value={languages.find((lang) => lang.value === language)}
                      onChange={(lang: SelectableValue<string>) => this.onLanguageChanged(lang.value ?? '')}
                      options={languages}
                      placeholder={t('shared-preferences.fields.locale-placeholder', 'Choose language')}
                      inputId="locale-select"
                    />
                  </Field>
                ) : null}

                <div className="gf-form-button-row">
                  <Button
                    type="submit"
                    variant="primary"
                    data-testid={selectors.components.UserProfile.preferencesSaveButton}
                  >
                    <Trans i18nKey="common.save">Save</Trans>
                  </Button>
                </div>
              </FieldSet>
            );
          }}
        </Form>
      </div>
    );
  }
}

export default SharedPreferences;

const getStyles = stylesFactory(() => {
  return {
    labelText: css`
      margin-right: 6px;
    `,
  };
});
