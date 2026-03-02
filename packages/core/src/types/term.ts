export interface TermFile {
  id: string;
  definition: string;
  synonyms?: string[];
  maps_to?: string[];
  owner?: string;
  tags?: string[];
}
