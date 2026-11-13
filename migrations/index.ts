import * as migration_20261104_103549_initial from './20261104_103549_initial';
import * as migration_20261111_013051_v170_questionnaire from './20261111_013051_v170_questionnaire';
import * as migration_20261113_070622_v183_email_settings from './20261113_070622_v183_email_settings';

export const migrations = [
  {
    up: migration_20261104_103549_initial.up,
    down: migration_20261104_103549_initial.down,
    name: '20261104_103549_initial',
  },
  {
    up: migration_20261111_013051_v170_questionnaire.up,
    down: migration_20261111_013051_v170_questionnaire.down,
    name: '20261111_013051_v170_questionnaire',
  },
  {
    up: migration_20261113_070622_v183_email_settings.up,
    down: migration_20261113_070622_v183_email_settings.down,
    name: '20261113_070622_v183_email_settings'
  },
];
