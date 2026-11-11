import * as migration_20261104_103549_initial from './20261104_103549_initial';
import * as migration_20261111_013051_v170_questionnaire from './20261111_013051_v170_questionnaire';

export const migrations = [
  {
    up: migration_20261104_103549_initial.up,
    down: migration_20261104_103549_initial.down,
    name: '20261104_103549_initial',
  },
  {
    up: migration_20261111_013051_v170_questionnaire.up,
    down: migration_20261111_013051_v170_questionnaire.down,
    name: '20261111_013051_v170_questionnaire'
  },
];
