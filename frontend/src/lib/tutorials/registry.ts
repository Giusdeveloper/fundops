import { capTableTutorialDefinition } from "./capTable";
import { companiesTutorialDefinition } from "./companies";
import { dashboardTutorialDefinition } from "./dashboard";
import { dossierTutorialDefinition } from "./dossier";
import { issuanceTutorialDefinition } from "./issuance";
import { loiTutorialDefinition } from "./loi";
import { platformTutorialDefinition } from "./platform";

export const tutorialRegistry = {
  capTable: capTableTutorialDefinition,
  companies: companiesTutorialDefinition,
  dashboard: dashboardTutorialDefinition,
  dossier: dossierTutorialDefinition,
  issuance: issuanceTutorialDefinition,
  loi: loiTutorialDefinition,
  platform: platformTutorialDefinition,
};
