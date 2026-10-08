import { integer,sqliteTable,text,index } from "drizzle-orm/sqlite-core";
export const researchQuotas=sqliteTable("research_quotas",{
  bucket:text("bucket").primaryKey(),used:integer("used").notNull(),expiresAt:integer("expires_at").notNull(),
},table=>[index("idx_research_quotas_expiry").on(table.expiresAt)]);
export const researchLeases=sqliteTable("research_leases",{
  name:text("name").primaryKey(),owner:text("owner").notNull(),expiresAt:integer("expires_at").notNull(),
});
