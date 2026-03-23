/* ========================================
   Board Definitions & Default Data
   ======================================== */

const now = new Date().toISOString();

export const BOARDS = {
  'product-design': {
    title: 'Product Design',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready to Start', color: '#3b82f6', wipLimit: 5, policy: { ready: 'Design brief completed, requirements clear, assets identified', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Design Review', color: '#8b5cf6', wipLimit: 3, policy: { ready: 'All deliverables attached, self-review done', done: 'Feedback addressed, stakeholder sign-off' } },
      { id: 'done', name: 'Done', color: '#10b981', wipLimit: 0, policy: { ready: '', done: 'Assets exported, handoff docs ready' } },
    ],
    tasks: [
      { id: 't1', title: 'Dashboard redesign exploration', desc: 'Explore new layout patterns for the analytics dashboard with improved data visualization', priority: 'critical', type: 'design', assignee: 'Sarah K.', due: '2026-03-25', column: 'in-progress', position: 0, size: 'L', requester: 'Product Team', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't2', title: 'Design system tokens audit', desc: 'Review and update color, spacing, and typography tokens across the system', priority: 'high', type: 'review', assignee: 'Mike B.', due: '2026-03-28', column: 'in-progress', position: 1, size: 'M', requester: 'Engineering', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't3', title: 'Onboarding flow wireframes', desc: 'Create low-fidelity wireframes for the new user onboarding experience', priority: 'high', type: 'design', assignee: 'Alex M.', due: '2026-03-30', column: 'ready', position: 0, size: 'M', requester: 'Product Team', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't4', title: 'Mobile navigation prototype', desc: 'Build interactive prototype for the revised mobile nav pattern', priority: 'medium', type: 'prototype', assignee: 'Sarah K.', due: '2026-04-02', column: 'ready', position: 1, size: 'L', requester: 'Product Team', platform: 'iOS', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't5', title: 'Accessibility audit — forms', desc: 'Full WCAG 2.1 audit of all form components', priority: 'high', type: 'review', assignee: 'Chris L.', due: '2026-03-26', column: 'review', position: 0, size: 'M', requester: 'Engineering', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't6', title: 'Illustration style guide', desc: 'Define illustration guidelines for marketing and product surfaces', priority: 'low', type: 'design', assignee: 'Alex M.', due: '2026-04-10', column: 'backlog', position: 0, size: null, requester: 'Marketing', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't7', title: 'Settings page redesign', desc: 'Simplify settings architecture and visual hierarchy', priority: 'medium', type: 'design', assignee: 'Mike B.', due: '2026-04-05', column: 'backlog', position: 1, size: 'S', requester: 'Product Team', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't8', title: 'Icon set expansion v2', desc: 'Add 40 new icons for the extended feature set', priority: 'low', type: 'design', assignee: 'Sarah K.', due: '2026-04-15', column: 'backlog', position: 2, size: 'XL', requester: 'Engineering', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't9', title: 'User interview synthesis', desc: 'Compile insights from recent round of user interviews', priority: 'medium', type: 'research', assignee: 'Chris L.', due: '2026-03-24', column: 'done', position: 0, size: 'S', requester: 'Leadership', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't10', title: 'Component library migration', desc: 'Migrate legacy components to the new design system foundation', priority: 'critical', type: 'development', assignee: 'Mike B.', due: '2026-03-29', column: 'in-progress', position: 2, size: 'XL', requester: 'Engineering', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't11', title: 'Dark mode color palette', desc: 'Finalize dark mode color palette and contrast ratios', priority: 'high', type: 'design', assignee: 'Alex M.', due: '2026-04-01', column: 'ready', position: 2, size: 'S', requester: 'Product Team', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 't12', title: 'Competitive analysis report', desc: 'Research competitor design patterns and UX flows', priority: 'low', type: 'research', assignee: 'Chris L.', due: '2026-04-12', column: 'backlog', position: 3, size: 'M', requester: 'Leadership', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
    ]
  },
  'business-dev': {
    title: 'Business Development',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'discovery', name: 'Discovery', color: '#3b82f6', wipLimit: 4, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'stakeholder', name: 'Stakeholder Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Completed', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: [
      { id: 'b1', title: 'Enterprise pricing model', desc: 'Design tiered pricing for enterprise clients', priority: 'critical', type: 'research', assignee: 'Dana R.', due: '2026-03-27', column: 'in-progress', position: 0, size: 'L', requester: 'Leadership', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'b2', title: 'Partnership deck design', desc: 'Visual design for the new partnership pitch deck', priority: 'high', type: 'design', assignee: 'Mike B.', due: '2026-03-30', column: 'in-progress', position: 1, size: 'M', requester: 'Client Services', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'b3', title: 'Market analysis dashboard', desc: 'Design dashboard for tracking market KPIs', priority: 'medium', type: 'design', assignee: 'Sarah K.', due: '2026-04-05', column: 'discovery', position: 0, size: null, requester: 'Marketing', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'b4', title: 'Client portal wireframes', desc: 'Wireframe the self-service client portal', priority: 'high', type: 'prototype', assignee: 'Alex M.', due: '2026-04-01', column: 'discovery', position: 1, size: 'L', requester: 'Client Services', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'b5', title: 'ROI calculator tool', desc: 'Interactive tool for prospects to calculate ROI', priority: 'medium', type: 'prototype', assignee: 'Chris L.', due: '2026-04-10', column: 'backlog', position: 0, size: 'XL', requester: 'Marketing', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'b6', title: 'Sales collateral refresh', desc: 'Update all sales materials with new brand guidelines', priority: 'low', type: 'design', assignee: 'Dana R.', due: '2026-04-15', column: 'backlog', position: 1, size: 'M', requester: 'Marketing', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'b7', title: 'Competitor UX benchmark', desc: 'Benchmark UX patterns of top 5 competitors', priority: 'high', type: 'research', assignee: 'Chris L.', due: '2026-03-28', column: 'stakeholder', position: 0, size: 'S', requester: 'Leadership', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'b8', title: 'Proposal template system', desc: 'Design reusable proposal template for biz dev team', priority: 'low', type: 'design', assignee: 'Mike B.', due: '2026-04-20', column: 'backlog', position: 2, size: null, requester: 'Client Services', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
    ]
  },
  'ux': {
    title: 'UX Research',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'planning', name: 'Planning', color: '#3b82f6', wipLimit: 4, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'analysis', name: 'Analysis', color: '#8b5cf6', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Complete', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: [
      { id: 'u1', title: 'Usability test — checkout', desc: 'Moderated usability test for the redesigned checkout flow', priority: 'critical', type: 'research', assignee: 'Chris L.', due: '2026-03-26', column: 'in-progress', position: 0, size: 'L', requester: 'Product Team', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'u2', title: 'Survey design — NPS Q1', desc: 'Design quarterly NPS survey questions', priority: 'high', type: 'research', assignee: 'Dana R.', due: '2026-03-28', column: 'planning', position: 0, size: 'S', requester: 'Marketing', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'u3', title: 'Persona update 2026', desc: 'Refresh user personas with latest research data', priority: 'medium', type: 'research', assignee: 'Chris L.', due: '2026-04-05', column: 'planning', position: 1, size: 'M', requester: 'Leadership', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'u4', title: 'Heuristic evaluation — settings', desc: 'Expert review of the settings experience', priority: 'high', type: 'review', assignee: 'Alex M.', due: '2026-03-30', column: 'in-progress', position: 1, size: 'M', requester: 'Product Team', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'u5', title: 'Journey map — onboarding', desc: 'Map the end-to-end onboarding journey', priority: 'medium', type: 'research', assignee: 'Dana R.', due: '2026-04-10', column: 'backlog', position: 0, size: 'L', requester: 'Product Team', platform: 'iOS', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'u6', title: 'A/B test analysis — CTA', desc: 'Analyze results from the homepage CTA experiment', priority: 'high', type: 'research', assignee: 'Chris L.', due: '2026-03-25', column: 'analysis', position: 0, size: 'S', requester: 'Marketing', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'u7', title: 'Card sorting study', desc: 'Run card sorting to validate new IA structure', priority: 'low', type: 'research', assignee: 'Alex M.', due: '2026-04-15', column: 'backlog', position: 1, size: null, requester: 'Engineering', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
    ]
  },
  'flagship': {
    title: 'Flagship Products',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'ready', name: 'Ready', color: '#3b82f6', wipLimit: 5, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'qa', name: 'QA / Testing', color: '#8b5cf6', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Shipped', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: [
      { id: 'f1', title: 'Weather app 3.0 UI overhaul', desc: 'Complete visual refresh of the flagship weather application', priority: 'critical', type: 'design', assignee: 'Sarah K.', due: '2026-04-01', column: 'in-progress', position: 0, size: 'XL', requester: 'Product Team', platform: 'iOS', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'f2', title: 'Real-time alerts redesign', desc: 'Redesign the severe weather alert notification system', priority: 'critical', type: 'design', assignee: 'Mike B.', due: '2026-03-28', column: 'in-progress', position: 1, size: 'L', requester: 'Engineering', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'f3', title: 'Map interaction prototype', desc: 'Build prototype for new radar map gestures and interactions', priority: 'high', type: 'prototype', assignee: 'Alex M.', due: '2026-04-05', column: 'ready', position: 0, size: 'L', requester: 'Product Team', platform: 'Android', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'f4', title: 'Widget design system', desc: 'Create a modular widget design system for embeddable weather components', priority: 'high', type: 'design', assignee: 'Sarah K.', due: '2026-04-10', column: 'ready', position: 1, size: 'XL', requester: 'Client Services', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'f5', title: 'Performance dashboard', desc: 'Design internal performance monitoring dashboard', priority: 'medium', type: 'design', assignee: 'Chris L.', due: '2026-04-15', column: 'backlog', position: 0, size: 'M', requester: 'Engineering', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'f6', title: 'Accessibility review — map', desc: 'Full a11y review of interactive map component', priority: 'high', type: 'review', assignee: 'Dana R.', due: '2026-03-30', column: 'qa', position: 0, size: 'M', requester: 'Engineering', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'f7', title: 'Hourly forecast cards', desc: 'Redesign hourly forecast card layout', priority: 'medium', type: 'design', assignee: 'Alex M.', due: '2026-04-08', column: 'backlog', position: 1, size: 'S', requester: 'Product Team', platform: 'iOS', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'f8', title: 'Onboarding tutorial flow', desc: 'Design first-run tutorial for new app features', priority: 'low', type: 'prototype', assignee: 'Mike B.', due: '2026-04-20', column: 'backlog', position: 2, size: null, requester: 'Marketing', platform: 'Android', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
    ]
  },
  'business-products': {
    title: 'Business Products',
    columns: [
      { id: 'backlog', name: 'Backlog', color: '#9ca3af', wipLimit: 0, policy: { ready: '', done: '' } },
      { id: 'scoping', name: 'Scoping', color: '#3b82f6', wipLimit: 4, policy: { ready: '', done: '' } },
      { id: 'in-progress', name: 'In Progress', color: '#f59e0b', wipLimit: 3, policy: { ready: '', done: '' } },
      { id: 'review', name: 'Review', color: '#8b5cf6', wipLimit: 2, policy: { ready: '', done: '' } },
      { id: 'done', name: 'Delivered', color: '#10b981', wipLimit: 0, policy: { ready: '', done: '' } },
    ],
    tasks: [
      { id: 'bp1', title: 'API portal redesign', desc: 'Redesign the developer API documentation portal', priority: 'critical', type: 'design', assignee: 'Mike B.', due: '2026-03-30', column: 'in-progress', position: 0, size: 'XL', requester: 'Engineering', platform: 'API', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'bp2', title: 'Enterprise dashboard v2', desc: 'Next iteration of the enterprise analytics dashboard', priority: 'high', type: 'design', assignee: 'Sarah K.', due: '2026-04-05', column: 'in-progress', position: 1, size: 'L', requester: 'Client Services', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'bp3', title: 'Data export tool UX', desc: 'Design the bulk data export workflow for enterprise clients', priority: 'high', type: 'prototype', assignee: 'Alex M.', due: '2026-04-01', column: 'scoping', position: 0, size: 'M', requester: 'Client Services', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'bp4', title: 'White-label theming engine', desc: 'Build a theming configuration tool for white-label partners', priority: 'medium', type: 'development', assignee: 'Chris L.', due: '2026-04-10', column: 'scoping', position: 1, size: 'XL', requester: 'Engineering', platform: 'All Platforms', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'bp5', title: 'SLA monitoring interface', desc: 'Design interface for monitoring service level agreements', priority: 'medium', type: 'design', assignee: 'Dana R.', due: '2026-04-15', column: 'backlog', position: 0, size: 'M', requester: 'Leadership', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'bp6', title: 'Billing page overhaul', desc: 'Simplify the billing and subscription management page', priority: 'high', type: 'design', assignee: 'Sarah K.', due: '2026-03-29', column: 'review', position: 0, size: 'M', requester: 'Product Team', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'bp7', title: 'Client onboarding wizard', desc: 'Design step-by-step onboarding for new enterprise clients', priority: 'low', type: 'prototype', assignee: 'Mike B.', due: '2026-04-20', column: 'backlog', position: 1, size: null, requester: 'Client Services', platform: 'Web', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
      { id: 'bp8', title: 'Usage analytics reports', desc: 'Design usage analytics report templates', priority: 'low', type: 'research', assignee: 'Alex M.', due: '2026-04-25', column: 'backlog', position: 2, size: null, requester: 'Marketing', platform: 'API', created_at: now, updated_at: now, comments: [], activity: [], links: [], depends_on: [], checklist: [], blocked: null, column_entered_at: now, column_history: [], archived: false, recurring: null },
    ]
  }
};

export const EPICS = [
  {
    id: 'ep1',
    title: 'Q2 App Redesign',
    description: 'Full redesign of the core app experience across mobile and web, targeting key usability improvements identified in Q1 research. Spans product design, UX research, and flagship product implementation.',
    owner: 'Mike B.',
    workspaces: ['product-design', 'ux', 'flagship'],
    startDate: '2026-03-01',
    endDate: '2026-05-31',
    healthManual: null,
    taskIds: ['t1', 't3', 't4', 't10', 'u1', 'u4', 'f1', 'f2', 'f3'],
  },
  {
    id: 'ep2',
    title: 'Enterprise Platform Launch',
    description: 'Design and launch the enterprise-tier experience including the partner portal, advanced analytics, and streamlined client onboarding flows.',
    owner: 'Dana R.',
    workspaces: ['business-dev', 'business-products'],
    startDate: '2026-02-15',
    endDate: '2026-04-30',
    healthManual: 'at-risk',
    taskIds: ['b1', 'b2', 'b4', 'bp1', 'bp2', 'bp3'],
  },
  {
    id: 'ep3',
    title: 'Design System Overhaul',
    description: 'Rebuild the component library and token system from the ground up to unify design language across all product surfaces — web, iOS, Android, and API.',
    owner: 'Sarah K.',
    workspaces: ['product-design', 'flagship', 'business-products'],
    startDate: '2026-01-10',
    endDate: '2026-04-15',
    healthManual: null,
    taskIds: ['t2', 't5', 't11', 'f4', 'f6', 'bp4'],
  },
  {
    id: 'ep4',
    title: 'User Research Initiative Q1',
    description: 'Comprehensive user research program to validate Q2 roadmap priorities, refresh personas with current data, and synthesize learnings for the design team.',
    owner: 'Chris L.',
    workspaces: ['ux', 'product-design'],
    startDate: '2026-01-20',
    endDate: '2026-03-31',
    healthManual: 'completed',
    taskIds: ['u2', 'u3', 'u6', 't9', 't12'],
  },
  {
    id: 'ep5',
    title: 'Partner API Experience',
    description: 'Design the developer portal, white-label theming engine, and partner onboarding wizard to support API partners and accelerate integration adoption.',
    owner: 'Alex M.',
    workspaces: ['business-products', 'business-dev'],
    startDate: '2026-03-10',
    endDate: '2026-06-15',
    healthManual: 'on-track',
    taskIds: ['bp1', 'bp4', 'bp7', 'b3', 'b7'],
  },
];

// ── Team Calendar Events ──────────────────────────────────────────────────────
export const CALENDAR_EVENTS = [
  // Week of Mar 23
  { id: 'ev1',  title: 'Design Sync',        type: 'meeting',   date: '2026-03-23', startHour: 10, endHour: 11, boardId: 'product-design', assignees: ['Mike B.', 'Alex M.'], notes: 'Weekly design standup' },
  { id: 'ev2',  title: 'Retrospective',       type: 'meeting',   date: '2026-03-24', startHour: 14, endHour: 15, boardId: null,             assignees: ['Mike B.'],            notes: 'End of sprint retro' },
  { id: 'ev3',  title: 'Alex — Out of Office', type: 'time-off', date: '2026-03-25', allDay: true,  boardId: null, assignees: ['Alex M.'],   notes: 'Family trip' },
  { id: 'ev4',  title: "Sarah's Birthday",    type: 'birthday',  date: '2026-03-26', allDay: true,  boardId: null, assignees: ['Sarah K.'],  notes: '' },
  { id: 'ev5',  title: 'UX Research Review',  type: 'review',    date: '2026-03-26', startHour: 11, endHour: 12, boardId: 'ux',             assignees: ['Chris L.'],           notes: '' },
  { id: 'ev6',  title: 'Team Offsite',        type: 'holiday',   date: '2026-03-27', allDay: true,  boardId: null, assignees: [],            notes: 'Full team day out' },
  { id: 'ev7',  title: 'Biz Dev Standup',     type: 'meeting',   date: '2026-03-27', startHour: 9,  endHour: 10, boardId: 'business-dev',   assignees: ['Alex M.'],            notes: '' },
  // Week of Mar 30
  { id: 'ev8',  title: 'Q2 Planning',         type: 'meeting',   date: '2026-03-30', startHour: 9,  endHour: 11, boardId: null,             assignees: ['Mike B.'],            notes: 'Q2 roadmap session' },
  { id: 'ev9',  title: 'Jordan — Out of Office', type: 'time-off', date: '2026-04-01', allDay: true, boardId: null, assignees: ['Jordan R.'], notes: '' },
  { id: 'ev10', title: 'Flagship Demo',       type: 'review',    date: '2026-04-02', startHour: 15, endHour: 16, boardId: 'flagship',       assignees: ['Mike B.'],            notes: 'Stakeholder demo' },
  { id: 'ev11', title: 'Biz Products Kickoff', type: 'meeting',  date: '2026-04-03', startHour: 10, endHour: 11, boardId: 'business-products', assignees: ['Alex M.'],         notes: '' },
  { id: 'ev12', title: 'Good Friday',         type: 'holiday',   date: '2026-04-03', allDay: true,  boardId: null, assignees: [],            notes: '' },
];

export const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981'
};

export const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

export const SIZE_LABELS = {
  S: 'Small',
  M: 'Medium',
  L: 'Large',
  XL: 'X-Large'
};
