'use client';

import DormantContacts from '@/components/people/dormant-contacts';

export default function DormantContactsWidget() {
  return <DormantContacts days={30} maxItems={5} />;
}
