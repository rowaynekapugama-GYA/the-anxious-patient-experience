import * as migration_20261104_103549_initial from './20261104_103549_initial';
import * as migration_20261111_013051_v170_questionnaire from './20261111_013051_v170_questionnaire';
import * as migration_20261113_070622_v183_email_settings from './20261113_070622_v183_email_settings';
import * as migration_20261116_010034_v184_last_login from './20261116_010034_v184_last_login';

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
    name: '20261113_070622_v183_email_settings',
  },
  {
    up: migration_20261116_010034_v184_last_login.up,
    down: migration_20261116_010034_v184_last_login.down,
    name: '20261116_010034_v184_last_login'
  },
];
