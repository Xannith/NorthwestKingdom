#!/usr/bin/env python3
"""
NWK stub page generator.
Creates placeholder HTML pages for all entries in the PAGES catalog below.
Run from repo root: python3 tools/generate-pages.py

Skips files that already exist (use --force to overwrite).
"""
import os
import sys

FORCE = '--force' in sys.argv

# Page catalog: (path, title, section, breadcrumb pairs, stub_note)
# breadcrumb: list of (label, url) — last item is current page (no url needed)
# section: public | member | admin
PAGES = [
    # --- Public area ---
    ("public/index.html",
     "Public Information Hub",
     "public",
     [("Home", "/")],
     "Gateway to all publicly available Northwest Kingdom information."),

    ("public/calendar/community-events.html",
     "Community Events",
     "public",
     [("Home", "/"), ("Calendar", "/public/calendar/")],
     "Community events open to all Northwest Kingdom residents."),

    ("public/calendar/work-parties.html",
     "Work Parties",
     "public",
     [("Home", "/"), ("Calendar", "/public/calendar/")],
     "Scheduled NWK work parties — dates, locations, and what to bring."),

    ("public/calendar/request-event.html",
     "Request an Event",
     "public",
     [("Home", "/"), ("Calendar", "/public/calendar/")],
     "Submit a community event for the NWK public calendar."),

    ("public/alternate-current/search.html",
     "Search — Alternate Current",
     "public",
     [("Home", "/"), ("Alternate Current", "/public/alternate-current/")],
     "Search the Alternate Current archive by keyword, year, topic, or name."),

    ("public/alternate-current/issues/index.html",
     "All Issues — Alternate Current",
     "public",
     [("Home", "/"), ("Alternate Current", "/public/alternate-current/")],
     "Chronological index of all Alternate Current issues."),

    ("public/alternate-current/topics/index.html",
     "Topics — Alternate Current",
     "public",
     [("Home", "/"), ("Alternate Current", "/public/alternate-current/")],
     "Browse Alternate Current issues by topic — land, events, governance, history, and more."),

    ("public/alternate-current/about.html",
     "About the Alternate Current",
     "public",
     [("Home", "/"), ("Alternate Current", "/public/alternate-current/")],
     "About the Alternate Current newsletter — history, contributors, and how to submit."),

    ("public/mlc-reference/governing-documents/index.html",
     "Governing Documents — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/")],
     "MLC governing documents: articles of incorporation, bylaws, covenants, and policies."),

    ("public/mlc-reference/governing-documents/articles-of-incorporation.html",
     "Articles of Incorporation — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/"), ("Governing Documents", "/public/mlc-reference/governing-documents/")],
     "MLC Articles of Incorporation — reference copy. Consult official MLC sources for authoritative version."),

    ("public/mlc-reference/governing-documents/bylaws.html",
     "Bylaws — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/"), ("Governing Documents", "/public/mlc-reference/governing-documents/")],
     "MLC Bylaws — reference copy. Consult official MLC sources for authoritative version."),

    ("public/mlc-reference/governing-documents/covenants-and-restrictions.html",
     "Covenants and Restrictions — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/"), ("Governing Documents", "/public/mlc-reference/governing-documents/")],
     "MLC Covenants and Restrictions — reference copy. Consult official MLC sources for authoritative version."),

    ("public/mlc-reference/governing-documents/policies.html",
     "Policies — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/"), ("Governing Documents", "/public/mlc-reference/governing-documents/")],
     "MLC policies relevant to Northwest Kingdom residents."),

    ("public/mlc-reference/community-center-rental.html",
     "Community Center Rental — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/")],
     "MLC community center rental process and current availability."),

    ("public/mlc-reference/land-for-sale.html",
     "Land for Sale — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/")],
     "Current MLC land listings and information about Co-op land transfers."),

    ("public/mlc-reference/public-calendar.html",
     "MLC Public Calendar — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/")],
     "MLC Town Council meetings and Co-op-wide events calendar."),

    ("public/mlc-reference/official-mlc-links.html",
     "Official MLC Links — MLC Reference",
     "public",
     [("Home", "/"), ("MLC Reference", "/public/mlc-reference/")],
     "Links to the official Miccosukee Land Co-op website and online resources."),

    ("public/photos/events.html",
     "Events Photos",
     "public",
     [("Home", "/"), ("Photos", "/public/photos/")],
     "Photos from Northwest Kingdom community events."),

    ("public/photos/land-and-nature.html",
     "Land and Nature Photos",
     "public",
     [("Home", "/"), ("Photos", "/public/photos/")],
     "Photos of NWK land, forest, wildlife, and natural features."),

    ("public/photos/history.html",
     "History Photos",
     "public",
     [("Home", "/"), ("Photos", "/public/photos/")],
     "Historical photos of Northwest Kingdom and the surrounding MLC community."),

    ("public/photos/submit-photo.html",
     "Submit a Photo",
     "public",
     [("Home", "/"), ("Photos", "/public/photos/")],
     "Submit a photo for the NWK photo archive. All submissions reviewed before publication."),

    ("public/contact.html",
     "Contact",
     "public",
     [("Home", "/")],
     "Contact information for Northwest Kingdom coordinators and role-holders."),

    ("public/faq.html",
     "FAQ",
     "public",
     [("Home", "/")],
     "Frequently asked questions about Northwest Kingdom and this website."),

    # --- Member: NWK Hub ---
    ("member/nwk-hub/index.html",
     "NWK Hub",
     "member",
     [("Dashboard", "/member/dashboard/")],
     "Notices, announcements, neighborhood map, people and households, and neighborhood history."),

    ("member/nwk-hub/notices.html",
     "Notices",
     "member",
     [("Dashboard", "/member/dashboard/"), ("NWK Hub", "/member/nwk-hub/")],
     "Current neighborhood notices — time-sensitive information for NWK residents."),

    ("member/nwk-hub/announcements.html",
     "Announcements",
     "member",
     [("Dashboard", "/member/dashboard/"), ("NWK Hub", "/member/nwk-hub/")],
     "General neighborhood announcements and updates."),

    ("member/nwk-hub/discussion-topics.html",
     "Discussion Topics",
     "member",
     [("Dashboard", "/member/dashboard/"), ("NWK Hub", "/member/nwk-hub/")],
     "Active discussion topics for Northwest Kingdom residents."),

    ("member/nwk-hub/neighborhood-map.html",
     "Neighborhood Map",
     "member",
     [("Dashboard", "/member/dashboard/"), ("NWK Hub", "/member/nwk-hub/")],
     "Map of Northwest Kingdom lots, common areas, roads, and key landmarks."),

    ("member/nwk-hub/people-and-households.html",
     "People and Households",
     "member",
     [("Dashboard", "/member/dashboard/"), ("NWK Hub", "/member/nwk-hub/")],
     "NWK resident and household directory. Member access only — not publicly accessible."),

    ("member/nwk-hub/neighborhood-history.html",
     "Neighborhood History",
     "member",
     [("Dashboard", "/member/dashboard/"), ("NWK Hub", "/member/nwk-hub/")],
     "The history of Northwest Kingdom — founding, milestones, and key events over the years."),

    # --- Member: Governance - MLC Framework ---
    ("member/governance/current-mlc-framework/source-documents.html",
     "Source Documents — Current MLC Framework",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("MLC Framework", "/member/governance/current-mlc-framework/")],
     "MLC source documents applicable to Northwest Kingdom, with links and notes."),

    ("member/governance/current-mlc-framework/rules-affecting-nwk.html",
     "Rules Affecting NWK — Current MLC Framework",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("MLC Framework", "/member/governance/current-mlc-framework/")],
     "Specific MLC rules and covenants that apply to Northwest Kingdom residents and properties."),

    ("member/governance/current-mlc-framework/obligations.html",
     "Obligations — Current MLC Framework",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("MLC Framework", "/member/governance/current-mlc-framework/")],
     "NWK resident obligations under the current MLC framework."),

    ("member/governance/current-mlc-framework/rights-and-limitations.html",
     "Rights and Limitations — Current MLC Framework",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("MLC Framework", "/member/governance/current-mlc-framework/")],
     "Rights and limitations of NWK residents and lot owners under the current MLC framework."),

    ("member/governance/current-mlc-framework/current-gaps.html",
     "Current Gaps — Current MLC Framework",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("MLC Framework", "/member/governance/current-mlc-framework/")],
     "Known gaps, ambiguities, or unresolved questions in how the MLC framework applies to NWK."),

    ("member/governance/current-mlc-framework/questions-for-review.html",
     "Questions for Review — Current MLC Framework",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("MLC Framework", "/member/governance/current-mlc-framework/")],
     "Questions about the MLC framework that need research, legal clarification, or TC discussion."),

    # --- Member: Governance - Representation ---
    ("member/governance/representation/representative-bio.html",
     "Representative Bio — Representation",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Representation", "/member/governance/representation/")],
     "Background, approach, and priorities of the current NWK TC representative."),

    ("member/governance/representation/representative-updates.html",
     "Representative Updates — Representation",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Representation", "/member/governance/representation/")],
     "Updates from the TC representative on recent meetings, decisions, and upcoming agenda items."),

    ("member/governance/representation/tc-agenda-watch.html",
     "TC Agenda Watch — Representation",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Representation", "/member/governance/representation/")],
     "Upcoming TC agenda items that may affect Northwest Kingdom. Track, discuss, and prepare."),

    ("member/governance/representation/vote-tracking.html",
     "Vote Tracking — Representation",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Representation", "/member/governance/representation/")],
     "Record of TC votes on matters affecting NWK, including how NWK's representative voted."),

    ("member/governance/representation/questions-for-tc.html",
     "Questions for TC — Representation",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Representation", "/member/governance/representation/")],
     "Submit questions or concerns for the TC representative to raise at Town Council."),

    ("member/governance/representation/tc-meeting-notes/index.html",
     "TC Meeting Notes",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Representation", "/member/governance/representation/")],
     "Notes from MLC Town Council meetings, organized chronologically."),

    # --- Member: Governance - NWK Gov Dev ---
    ("member/governance/nwk-governance-development/operating-principles.html",
     "Operating Principles — NWK Governance Development",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Governance Dev.", "/member/governance/nwk-governance-development/")],
     "Proposed operating principles for Northwest Kingdom neighborhood organization."),

    ("member/governance/nwk-governance-development/roles-and-responsibilities/treasurer.html",
     "Treasurer — Roles",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Governance Dev.", "/member/governance/nwk-governance-development/"), ("Roles", "/member/governance/nwk-governance-development/roles-and-responsibilities/")],
     "Role definition for the NWK Treasurer — finances, shared expenses, and financial records."),

    ("member/governance/nwk-governance-development/roles-and-responsibilities/bookkeeper.html",
     "Bookkeeper — Roles",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Governance Dev.", "/member/governance/nwk-governance-development/"), ("Roles", "/member/governance/nwk-governance-development/roles-and-responsibilities/")],
     "Role definition for the NWK Bookkeeper — day-to-day financial record keeping."),

    ("member/governance/nwk-governance-development/roles-and-responsibilities/role-discussion.html",
     "Role Discussion — Roles",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Governance Dev.", "/member/governance/nwk-governance-development/"), ("Roles", "/member/governance/nwk-governance-development/roles-and-responsibilities/")],
     "Discussion of role definitions — open for resident comment and revision."),

    ("member/governance/nwk-governance-development/decision-making/index.html",
     "Decision-Making — NWK Governance Development",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Governance Dev.", "/member/governance/nwk-governance-development/")],
     "How Northwest Kingdom makes decisions — proposed process and principles."),

    ("member/governance/nwk-governance-development/draft-documents/index.html",
     "Draft Documents — NWK Governance Development",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Governance Dev.", "/member/governance/nwk-governance-development/")],
     "Working drafts of NWK governance documents under development."),

    ("member/governance/nwk-governance-development/discussion/index.html",
     "Discussion — NWK Governance Development",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Governance Dev.", "/member/governance/nwk-governance-development/")],
     "Open discussion space for governance development topics."),

    ("member/governance/nwk-governance-development/decision-log.html",
     "Decision Log — NWK Governance Development",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Governance Dev.", "/member/governance/nwk-governance-development/")],
     "Log of decisions made in the governance development process, with dates and rationale."),

    # --- Member: Governance - Records ---
    ("member/governance/records/index.html",
     "Records — Governance",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/")],
     "Official NWK records: meeting notes, decisions, proposals, votes, notices, and historical records."),

    ("member/governance/records/meeting-notes/index.html",
     "Meeting Notes — Records",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Records", "/member/governance/records/")],
     "Notes from Northwest Kingdom neighborhood meetings, organized by date."),

    ("member/governance/records/decisions/index.html",
     "Decisions — Records",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Records", "/member/governance/records/")],
     "Log of significant NWK decisions with dates, participants, and rationale."),

    ("member/governance/records/proposals/index.html",
     "Proposals — Records",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Records", "/member/governance/records/")],
     "Formal proposals brought to the neighborhood, with status and outcome."),

    ("member/governance/records/votes/index.html",
     "Votes — Records",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Records", "/member/governance/records/")],
     "Record of neighborhood votes on proposals and decisions."),

    ("member/governance/records/archived-notices/index.html",
     "Archived Notices — Records",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Records", "/member/governance/records/")],
     "Archive of past neighborhood notices."),

    ("member/governance/records/historical-records/index.html",
     "Historical Records — Records",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Governance", "/member/governance/"), ("Records", "/member/governance/records/")],
     "Historical documents and records from Northwest Kingdom's past."),

    # --- Member: Operations detail pages ---
    ("member/operations/roles-and-responsibilities/index.html",
     "Roles and Responsibilities — Operations",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/")],
     "Who is responsible for what in NWK operations and maintenance."),

    ("member/operations/maintenance/index.html",
     "Maintenance — Operations",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/")],
     "Roads, drainage, signage, common areas, and maintenance log."),

    ("member/operations/maintenance/roads.html",
     "Roads — Maintenance",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Maintenance", "/member/operations/maintenance/")],
     "NWK road conditions, maintenance schedule, repair log, and known issues."),

    ("member/operations/maintenance/drainage.html",
     "Drainage — Maintenance",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Maintenance", "/member/operations/maintenance/")],
     "Drainage systems, culverts, problem areas, and maintenance history."),

    ("member/operations/maintenance/signage.html",
     "Signage — Maintenance",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Maintenance", "/member/operations/maintenance/")],
     "NWK signage inventory, condition, and replacement log."),

    ("member/operations/maintenance/common-areas.html",
     "Common Areas — Maintenance",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Maintenance", "/member/operations/maintenance/")],
     "Common area maintenance schedule, assignments, and log."),

    ("member/operations/maintenance/maintenance-log.html",
     "Maintenance Log",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Maintenance", "/member/operations/maintenance/")],
     "Chronological log of all maintenance work performed in Northwest Kingdom."),

    ("member/operations/work-parties/index.html",
     "Work Parties — Operations",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/")],
     "Scheduled and past work parties — coordination, sign-up, and records."),

    ("member/operations/work-parties/upcoming.html",
     "Upcoming Work Parties",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Work Parties", "/member/operations/work-parties/")],
     "Upcoming NWK work parties — dates, focus areas, what to bring."),

    ("member/operations/work-parties/completed.html",
     "Completed Work Parties",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Work Parties", "/member/operations/work-parties/")],
     "Archive of completed work parties with summary of work done."),

    ("member/operations/work-parties/tools-and-supplies.html",
     "Tools and Supplies",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Work Parties", "/member/operations/work-parties/")],
     "Shared tools inventory, storage location, and supply needs."),

    ("member/operations/work-parties/sign-up.html",
     "Work Party Sign-Up",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Work Parties", "/member/operations/work-parties/")],
     "Sign up for upcoming work parties."),

    ("member/operations/land-stewardship/index.html",
     "Land Stewardship — Operations",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/")],
     "Trees, invasive removal, trails, wildlife, and stewardship log."),

    ("member/operations/land-stewardship/trees.html",
     "Trees — Land Stewardship",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Land Stewardship", "/member/operations/land-stewardship/")],
     "Significant trees, health assessments, removal records, and planting log."),

    ("member/operations/land-stewardship/invasive-removal.html",
     "Invasive Removal — Land Stewardship",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Land Stewardship", "/member/operations/land-stewardship/")],
     "Invasive species identification, removal efforts, and progress tracking."),

    ("member/operations/land-stewardship/trails.html",
     "Trails — Land Stewardship",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Land Stewardship", "/member/operations/land-stewardship/")],
     "NWK trail inventory, condition, and maintenance notes."),

    ("member/operations/land-stewardship/wildlife.html",
     "Wildlife — Land Stewardship",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Land Stewardship", "/member/operations/land-stewardship/")],
     "Wildlife observations, species of note, and habitat stewardship notes."),

    ("member/operations/land-stewardship/stewardship-log.html",
     "Stewardship Log",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/"), ("Land Stewardship", "/member/operations/land-stewardship/")],
     "Log of land stewardship activities in Northwest Kingdom."),

    ("member/operations/emergency-and-safety/index.html",
     "Emergency and Safety — Operations",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/")],
     "Emergency contacts, evacuation info, and safety resources for NWK residents."),

    ("member/operations/forms/index.html",
     "Forms — Operations",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/")],
     "Operational forms: maintenance requests, work party proposals, event requests."),

    ("member/operations/standard-operating-procedures/index.html",
     "Standard Operating Procedures",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Operations", "/member/operations/")],
     "SOPs for recurring NWK operational tasks — road grading, invasive removal, work party coordination, etc."),

    # --- Member: Projects ---
    ("member/projects/active/index.html",
     "Active Projects",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Projects", "/member/projects/")],
     "Currently active Northwest Kingdom projects."),

    ("member/projects/proposed/index.html",
     "Proposed Projects",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Projects", "/member/projects/")],
     "Projects proposed for neighborhood consideration."),

    ("member/projects/completed/index.html",
     "Completed Projects",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Projects", "/member/projects/")],
     "Archive of completed NWK projects with summaries."),

    ("member/projects/deferred/index.html",
     "Deferred Projects",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Projects", "/member/projects/")],
     "Projects that have been deferred — with notes on why and when to revisit."),

    ("member/projects/project-templates/index.html",
     "Project Templates",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Projects", "/member/projects/")],
     "Templates for proposing and documenting NWK projects."),

    # --- Member: Calendar ---
    ("member/calendar/index.html",
     "Member Calendar",
     "member",
     [("Dashboard", "/member/dashboard/")],
     "Internal NWK calendar — planning details, recurring events, and event coordination."),

    ("member/calendar/internal-calendar.html",
     "Internal Calendar",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Calendar", "/member/calendar/")],
     "Full internal calendar for NWK members."),

    ("member/calendar/event-planning.html",
     "Event Planning",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Calendar", "/member/calendar/")],
     "Resources for planning NWK events."),

    ("member/calendar/recurring-events.html",
     "Recurring Events",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Calendar", "/member/calendar/")],
     "Recurring NWK events — work parties, seasonal gatherings, and annual traditions."),

    ("member/calendar/calendar-request.html",
     "Calendar Request",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Calendar", "/member/calendar/")],
     "Submit an event for the NWK member calendar."),

    # --- Member: Documents ---
    ("member/documents/index.html",
     "Documents",
     "member",
     [("Dashboard", "/member/dashboard/")],
     "NWK documents, MLC reference copies, templates, forms, and archive."),

    ("member/documents/nwk-documents/index.html",
     "NWK Documents",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Documents", "/member/documents/")],
     "Official and working documents produced by Northwest Kingdom."),

    ("member/documents/mlc-reference-copies/index.html",
     "MLC Reference Copies",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Documents", "/member/documents/")],
     "Local reference copies of MLC documents for NWK resident use."),

    ("member/documents/templates/index.html",
     "Templates",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Documents", "/member/documents/")],
     "Document templates for meeting notes, proposals, project records, and more."),

    ("member/documents/forms/index.html",
     "Forms",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Documents", "/member/documents/")],
     "Active forms used by NWK residents and role-holders."),

    ("member/documents/archive/index.html",
     "Document Archive",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Documents", "/member/documents/")],
     "Archived historical documents from Northwest Kingdom."),

    # --- Member: Search ---
    ("member/search/index.html",
     "Search",
     "member",
     [("Dashboard", "/member/dashboard/")],
     "Search all member-area content: records, documents, discussions, and more."),

    ("member/search/advanced-search.html",
     "Advanced Search",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Search", "/member/search/")],
     "Advanced search with filters by section, date range, topic, and document type."),

    # --- Member: Profile ---
    ("member/profile/index.html",
     "Profile",
     "member",
     [("Dashboard", "/member/dashboard/")],
     "Your NWK account settings, household info, and preferences."),

    ("member/profile/household-info.html",
     "Household Info — Profile",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Profile", "/member/profile/")],
     "Your household information in the NWK directory. Control what other members can see."),

    ("member/profile/notification-settings.html",
     "Notification Settings — Profile",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Profile", "/member/profile/")],
     "Manage how and when you receive NWK notifications and digest emails."),

    ("member/profile/privacy-settings.html",
     "Privacy Settings — Profile",
     "member",
     [("Dashboard", "/member/dashboard/"), ("Profile", "/member/profile/")],
     "Control what information is visible to other NWK members."),

    # --- Admin sub-pages ---
    ("admin/users/index.html",
     "Users — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Manage member accounts, review access requests, and assign roles."),

    ("admin/access-roles/index.html",
     "Access Roles — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Define and manage role permissions. Current roles: public visitor, NWK member, TC representative, content maintainer, records steward, technical administrator, admin."),

    ("admin/content-review/index.html",
     "Content Review — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Review submitted content pending publication approval."),

    ("admin/calendar-approvals/index.html",
     "Calendar Approvals — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Review and approve event submissions for the public and member calendars."),

    ("admin/document-management/index.html",
     "Document Management — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Upload, organize, and manage documents. Ensure no private documents appear in public assets."),

    ("admin/photo-review/index.html",
     "Photo Review — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Review submitted photos, verify permissions, and approve for public or member display."),

    ("admin/alternate-current-manager/index.html",
     "Alternate Current Manager — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Upload new Alternate Current issues, manage archive metadata, and update the search index."),

    ("admin/mlc-reference-manager/index.html",
     "MLC Reference Manager — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Update MLC reference document links and verify that external MLC links are current."),

    ("admin/search-index-manager/index.html",
     "Search Index Manager — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Manage public, member, and admin search indexes. Verify no private content leaks into public search."),

    ("admin/backups/index.html",
     "Backups — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Backup schedule, current status, storage configuration, and restoration documentation."),

    ("admin/audit-log/index.html",
     "Audit Log — Admin",
     "admin",
     [("Admin", "/admin/")],
     "Log of significant site actions: content changes, access grants/revocations, document uploads."),
]

SECTION_BADGE = {
    "public": '<span class="section-badge section-badge--public">Public</span>',
    "member": '<span class="section-badge section-badge--member">Member area</span>',
    "admin":  '<span class="section-badge section-badge--admin">Admin area</span>',
}

AUTH_GATE = {
    "public": "",
    "member": '''      <div class="auth-gate" role="alert">
        <span class="auth-gate-icon" aria-hidden="true">&#128274;</span>
        <div class="auth-gate-body">
          <h3>Authentication required</h3>
          <p>Member login required. <a href="/login/">Log in</a> &bull; <a href="/login/request-access.html">Request access</a></p>
        </div>
      </div>
''',
    "admin": '''      <div class="auth-gate" role="alert">
        <span class="auth-gate-icon" aria-hidden="true">&#128274;</span>
        <div class="auth-gate-body">
          <h3>Administrator access required</h3>
          <p>Admin authentication required. <a href="/login/">Log in</a></p>
        </div>
      </div>
''',
}

NAV_LABEL = {
    "public": "Public navigation",
    "member": "Member navigation",
    "admin":  "Admin navigation",
}

CSS_DEPTH_MAP = {}

def asset_path(file_path):
    depth = file_path.count('/') - (1 if file_path.startswith('/') else 0)
    return '/assets/css/main.css'

def build_breadcrumb(crumbs, current_title):
    if not crumbs:
        return ""
    items = ""
    for label, url in crumbs:
        items += f'\n            <li><a href="{url}">{label}</a></li>'
    items += f"\n            <li><span aria-current=\"page\">{current_title}</span></li>"
    return f'''      <nav class="breadcrumb" aria-label="Breadcrumb">
        <ol>{items}
        </ol>
      </nav>
'''

def generate_page(path, title, section, crumbs, stub_note):
    short_title = title.split(" — ")[0] if " — " in title else title
    auth_gate = AUTH_GATE.get(section, "")
    badge = SECTION_BADGE.get(section, "")
    nav_label = NAV_LABEL.get(section, "Public navigation")
    breadcrumb = build_breadcrumb(crumbs, short_title)

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{title} — Northwest Kingdom</title>
  <link rel="stylesheet" href="/assets/css/main.css">
</head>
<body data-section="{section}">
  <a class="skip-link" href="#main-content">Skip to main content</a>
  <div id="site-header"></div>
  <nav id="site-nav" aria-label="{nav_label}"></nav>

  <main id="main-content">
    <div class="container page-wrapper">
{breadcrumb}
{auth_gate}
      <div class="page-header">
        {badge}
        <h1>{short_title}</h1>
        <p>{stub_note}</p>
      </div>

      <div class="notice notice--info">
        <strong>Content placeholder.</strong>
        This page is part of the Northwest Kingdom site framework.
        Content will be added as records, documents, and information are organized.
      </div>

    </div>
  </main>

  <div id="site-footer" role="contentinfo"></div>
  <script src="/assets/js/components.js"></script>
  <script src="/assets/js/main.js"></script>
</body>
</html>
"""


def main():
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    created = 0
    skipped = 0
    for path, title, section, crumbs, stub_note in PAGES:
        full_path = os.path.join(repo_root, path)
        if os.path.exists(full_path) and not FORCE:
            skipped += 1
            continue
        os.makedirs(os.path.dirname(full_path), exist_ok=True)
        content = generate_page(path, title, section, crumbs, stub_note)
        with open(full_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"  created: {path}")
        created += 1

    print(f"\nDone. Created {created} page(s), skipped {skipped} existing.")
    if skipped:
        print("Use --force to overwrite existing files.")


if __name__ == "__main__":
    main()
