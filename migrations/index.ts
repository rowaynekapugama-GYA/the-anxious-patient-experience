import * as migration_20261104_103549_initial from './20261104_103549_initial';
import * as migration_20261111_013051_v170_questionnaire from './20261111_013051_v170_questionnaire';
import * as migration_20261113_070622_v183_email_settings from './20261113_070622_v183_email_settings';
import * as migration_20261116_010034_v184_last_login from './20261116_010034_v184_last_login';
import * as migration_20261116_012208_v190_welcome_pack from './20261116_012208_v190_welcome_pack';
import * as migration_20261117_010000_v1100_terms_owner from './20261117_010000_v1100_terms_owner';
import * as migration_20261124_010000_v1150_gtm from './20261124_010000_v1150_gtm';
import * as migration_20261124_090000_v1160_profile_link from './20261124_090000_v1160_profile_link';
import * as migration_20261125_090000_v1180_treatment_plans from './20261125_090000_v1180_treatment_plans';

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
    name: '20261116_010034_v184_last_login',
  },
  {
    up: migration_20261116_012208_v190_welcome_pack.up,
    down: migration_20261116_012208_v190_welcome_pack.down,
    name: '20261116_012208_v190_welcome_pack',
  },
  {
    up: migration_20261117_010000_v1100_terms_owner.up,
    down: migration_20261117_010000_v1100_terms_owner.down,
    name: '20261117_010000_v1100_terms_owner',
  },
  {
    up: migration_20261124_010000_v1150_gtm.up,
    down: migration_20261124_010000_v1150_gtm.down,
    name: '20261124_010000_v1150_gtm',
  },
  {
    up: migration_20261124_090000_v1160_profile_link.up,
    down: migration_20261124_090000_v1160_profile_link.down,
    name: '20261124_090000_v1160_profile_link',
  },
  {
    up: migration_20261125_090000_v1180_treatment_plans.up,
    down: migration_20261125_090000_v1180_treatment_plans.down,
    name: '20261125_090000_v1180_treatment_plans',
  },
];
