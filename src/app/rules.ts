// Подключённый модуль правил. В M1 он один; выбор по `campaign.rules.id` появится вместе со вторым модулем.
import type { RulesModule } from '../rules/api';
import { opend6 } from '../rules/opend6';

export const rulesModule: RulesModule = opend6;
