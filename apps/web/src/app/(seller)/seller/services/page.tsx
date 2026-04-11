import { listSellerServices } from "@atlas/database";
import { PageHeader, Panel, RecordListPanel } from "@atlas/ui";
import { resolveWorkspaceActor } from "@/lib/server/actor-context";
import { getAtlasWorkspaceDetailHref } from "@/lib/detail-hrefs";
import { readWorkflowFeedback } from "@/lib/workflow-feedback";
import { WorkflowFeedbackPanel } from "@/components/workflow-feedback-panel";
import { WorkflowFormField } from "@/components/workflow-form-field";
import { WorkflowFormPanel } from "@/components/workflow-form-panel";
import { createSellerServiceAction, updateSellerServiceAction } from "../actions";

const inputClassName =
  "w-full rounded-2xl border border-[var(--atlas-line)] bg-black/20 px-4 py-3 text-sm text-[var(--atlas-ink)] outline-none transition placeholder:text-[var(--atlas-muted)] focus:border-[var(--atlas-accent-strong)]";

type SellerServicesPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

function formatCurrencyMinor(amountMinor: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency
  }).format(amountMinor / 100);
}

export default async function SellerServicesPage({ searchParams }: SellerServicesPageProps) {
  const resolution = await resolveWorkspaceActor("SELLER");

  if (resolution.status !== "ready") {
    return null;
  }

  const [services, resolvedSearchParams] = await Promise.all([
    listSellerServices(resolution.actor.organization.id),
    searchParams
  ]);
  const feedback = readWorkflowFeedback(resolvedSearchParams);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Seller services"
        title="Service catalog and pricing baseline"
        description="Create, publish, archive, and reprices seller services through real schema-backed catalog records."
      />
      {feedback ? <WorkflowFeedbackPanel title={feedback.title} description={feedback.description} tone={feedback.tone} /> : null}
      <WorkflowFormPanel
        eyebrow="Create seller service"
        title="Add a service to the seller catalog"
        description="Seller services define a durable service key, publication posture, visibility boundary, and fixed-price baseline."
        action={createSellerServiceAction}
        submitLabel="Create service"
      >
        <div className="grid gap-4 md:grid-cols-2">
          <WorkflowFormField label="Service key" hint="Used for buyer request targeting and seller-side matching">
            <input className={inputClassName} type="text" name="key" placeholder="premium-dataset-access" required />
          </WorkflowFormField>
          <WorkflowFormField label="Service name">
            <input className={inputClassName} type="text" name="name" placeholder="Premium Dataset Access" required />
          </WorkflowFormField>
        </div>
        <WorkflowFormField label="Description">
          <textarea
            className={`${inputClassName} min-h-28`}
            name="description"
            placeholder="Describe the paid digital capability, delivery posture, and buyer-facing outcome."
            required
          />
        </WorkflowFormField>
        <div className="grid gap-4 md:grid-cols-4">
          <WorkflowFormField label="Category">
            <input className={inputClassName} type="text" name="category" placeholder="dataset-access" required />
          </WorkflowFormField>
          <WorkflowFormField label="Status">
            <select className={inputClassName} name="status" defaultValue="DRAFT">
              <option value="DRAFT">Draft</option>
              <option value="PUBLISHED">Published</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Visibility">
            <select className={inputClassName} name="visibility" defaultValue="PRIVATE">
              <option value="PRIVATE">Private</option>
              <option value="TRUSTED_BUYERS">Trusted buyers</option>
              <option value="PUBLIC">Public</option>
            </select>
          </WorkflowFormField>
          <WorkflowFormField label="Pricing model">
            <select className={inputClassName} name="pricingModel" defaultValue="FIXED">
              <option value="FIXED">Fixed</option>
            </select>
          </WorkflowFormField>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <WorkflowFormField label="Price minor">
            <input className={inputClassName} type="number" min="1" name="priceMinor" placeholder="2400" required />
          </WorkflowFormField>
          <WorkflowFormField label="Currency">
            <input className={inputClassName} type="text" name="currency" defaultValue="USD" maxLength={3} required />
          </WorkflowFormField>
        </div>
      </WorkflowFormPanel>
      <RecordListPanel
        eyebrow="Service ledger"
        title="Seller services"
        description="Catalog records now carry their own key, pricing posture, status, and buyer-demand linkage."
        items={services.map((service) => ({
          id: service.id,
          title: service.name,
          description: `${formatCurrencyMinor(service.priceMinor, service.currency)} · ${service.category}`,
          detail: `${service.key} · ${service.visibility} · ${service.linkedRequestCount} linked requests`,
          href: getAtlasWorkspaceDetailHref("SELLER", "services", service.id) ?? undefined,
          statusLabel: service.status,
          statusTone: service.status === "PUBLISHED" ? "success" : service.status === "ARCHIVED" ? "critical" : "warning"
        }))}
        emptyTitle="No seller services yet"
        emptyDescription="Create the first seller service to begin the two-sided product baseline."
      />
      <div className="grid gap-4">
        {services.map((service) => (
          <Panel key={service.id} className="space-y-5 p-6">
            <div className="space-y-1">
              <h2 className="text-lg font-semibold">{service.name}</h2>
              <p className="text-sm text-[var(--atlas-muted)]">
                {service.key} · {formatCurrencyMinor(service.priceMinor, service.currency)} · {service.category}
              </p>
            </div>
            <form action={updateSellerServiceAction.bind(null, service.id)} className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <WorkflowFormField label="Service key">
                  <input className={inputClassName} type="text" name="key" defaultValue={service.key} required />
                </WorkflowFormField>
                <WorkflowFormField label="Service name">
                  <input className={inputClassName} type="text" name="name" defaultValue={service.name} required />
                </WorkflowFormField>
              </div>
              <WorkflowFormField label="Description">
                <textarea
                  className={`${inputClassName} min-h-28`}
                  name="description"
                  defaultValue={service.description}
                  required
                />
              </WorkflowFormField>
              <div className="grid gap-4 md:grid-cols-4">
                <WorkflowFormField label="Category">
                  <input className={inputClassName} type="text" name="category" defaultValue={service.category} required />
                </WorkflowFormField>
                <WorkflowFormField label="Status">
                  <select className={inputClassName} name="status" defaultValue={service.status}>
                    <option value="DRAFT">Draft</option>
                    <option value="PUBLISHED">Published</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </WorkflowFormField>
                <WorkflowFormField label="Visibility">
                  <select className={inputClassName} name="visibility" defaultValue={service.visibility}>
                    <option value="PRIVATE">Private</option>
                    <option value="TRUSTED_BUYERS">Trusted buyers</option>
                    <option value="PUBLIC">Public</option>
                  </select>
                </WorkflowFormField>
                <WorkflowFormField label="Pricing model">
                  <select className={inputClassName} name="pricingModel" defaultValue={service.pricingModel}>
                    <option value="FIXED">Fixed</option>
                  </select>
                </WorkflowFormField>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <WorkflowFormField label="Price minor">
                  <input className={inputClassName} type="number" min="1" name="priceMinor" defaultValue={service.priceMinor} required />
                </WorkflowFormField>
                <WorkflowFormField label="Currency">
                  <input className={inputClassName} type="text" name="currency" defaultValue={service.currency} maxLength={3} required />
                </WorkflowFormField>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  className="inline-flex items-center rounded-full border border-[var(--atlas-accent-strong)] bg-[var(--atlas-accent)] px-5 py-2.5 text-sm font-medium text-[var(--atlas-ink)] transition hover:border-[var(--atlas-ink)] hover:bg-[var(--atlas-accent-strong)]"
                >
                  Update service
                </button>
              </div>
            </form>
          </Panel>
        ))}
      </div>
    </div>
  );
}
