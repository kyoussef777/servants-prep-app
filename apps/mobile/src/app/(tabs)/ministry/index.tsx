import { router, type Href } from "expo-router";
import type { SundaySchoolDashboard } from "@stmark/contracts";
import { Card, Copy, RowLink } from "@/components/ui";
import { Page } from "@/components/forms";
import { endpoint, useResource } from "@/data/resources";
import { ministryAccess } from "@/data/ministry";
import { usePortal } from "@/data/portal-provider";

export default function Ministry() {
  const resource = useResource<SundaySchoolDashboard>(endpoint("dashboard"));
  const { classes } = usePortal();
  const access = ministryAccess(resource.data, classes);
  const link = (title: string, subtitle: string, href: Href) => <RowLink key={title} title={title} subtitle={subtitle} onPress={() => router.push(href)} />;
  return <Page title="Ministry" {...resource}>
    <Copy kind="title">Your Sunday School</Copy>
    {resource.data && <><Card>
      {link("Children & families", "Roster, child profiles, family details, and history", "/roster")}
      {link("Visitations", "Pastoral visits and confidential notes", "/visitations")}
      {link("Attendance reports", "Children’s attendance and ministry trends", "/reports")}
      {access.canTakeServantAttendance && link("Servant attendance", "Record your team’s weekly attendance", "/servant-attendance")}
      {access.createLevels.length > 0 && link("Child registrations", "Review and place incoming children", "/registrations")}
      {link("Feedback", "Share ideas and vote on improvements", "/feedback")}
    </Card>
    {access.admin && <><Copy kind="heading">Administration</Copy><Card>
      {link("Age groups", "Grade bands, coordinators, and priest overseers", "/age-groups")}
      {link("People & organization", "Accounts, roles, and ministry teams", "/people")}
      {link("Servant applications", "Review ministry applications", "/applications")}
      {link("Activity", "Recent actions and security history", "/activity")}
    </Card></>}
    {access.readOnly && <Copy kind="caption">Your ministry records are read-only. Feedback participation remains available.</Copy>}</>}
  </Page>;
}
