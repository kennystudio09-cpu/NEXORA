import { test, expect, type Page, type BrowserContext } from "@playwright/test";
import { randomUUID } from "node:crypto";
import type { CustomerRecord } from "../../packages/shared/src";
const password="Nexora-CRM-E2E-password!";
const headers={"x-nexora-request":"1"};
async function register(page:Page,label:string){
  const email=`crm-browser-${label}-${randomUUID()}@example.test`;
  await page.goto("http://localhost:3101/register");await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Register",exact:true}).click();await expect(page).toHaveURL(/dashboard/);await expect(page.getByText(email,{exact:true})).toBeVisible();return email;
}
async function merchant(context:BrowserContext,name:string){
  const response=await context.request.post("http://localhost:3101/api/tenants",{headers,data:{name}});expect(response.status()).toBe(201);return (await response.json()) as {id:string;name:string};
}
async function contact(context:BrowserContext,tenantId:string,name:string){
  const response=await context.request.post(`http://localhost:3101/api/tenants/${tenantId}/customers`,{headers,data:{name}});expect(response.status()).toBe(201);return await response.json() as CustomerRecord;
}

test("CRM mobile create, view, edit, tags, notes, follow-up, filters and pagination",async({page,context})=>{
  await page.setViewportSize({width:390,height:844});await register(page,"owner");const tenant=await merchant(context,"CRM mobile merchant");
  await page.getByRole("link",{name:"Customers",exact:true}).click();await expect(page.getByRole("heading",{name:"Customer CRM",exact:true})).toBeVisible();await expect(page.getByText("No customers found",{exact:true})).toBeVisible();
  await page.getByRole("link",{name:"New customer",exact:true}).click();
  await page.getByLabel("Customer name",{exact:true}).fill("Aisyah Browser");await page.getByLabel("Email",{exact:true}).fill("aisyah@example.test");await page.getByLabel("Phone",{exact:true}).fill("+60 12-345 6789");await page.getByLabel("Customer status").selectOption("ACTIVE");await page.getByRole("textbox",{name:/^Tags/}).fill("VIP, Returning");await page.getByLabel("Notes",{exact:true}).fill("Prefers afternoon calls");await page.getByRole("button",{name:"Save customer",exact:true}).click();
  await expect(page.getByTestId("customer-name")).toHaveText("Aisyah Browser");await expect(page.getByText("vip",{exact:true})).toBeVisible();await expect(page.getByText("Prefers afternoon calls",{exact:true})).toBeVisible();
  const customerId=page.url().split("/").pop()!;
  await page.getByRole("link",{name:"Edit customer",exact:true}).click();await page.getByLabel("Customer name",{exact:true}).fill("Aisyah Updated Browser");await page.getByLabel("Notes",{exact:true}).fill("Ready for follow-up");await page.getByRole("button",{name:"Save customer",exact:true}).click();await expect(page.getByTestId("customer-name")).toHaveText("Aisyah Updated Browser");await expect(page.getByText("Ready for follow-up",{exact:true})).toBeVisible();
  await page.getByLabel("New follow-up").fill("Discussed the next appointment");await page.getByRole("button",{name:"Add follow-up",exact:true}).click();await expect(page.getByText("Discussed the next appointment",{exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();await page.screenshot({path:"test-results/crm-mobile-detail.png",fullPage:true});
  for(let i=0;i<10;i++)await contact(context,tenant.id,`Pagination customer ${i}`);
  await page.goto("/crm");await page.getByLabel("Search",{exact:true}).fill("aisyah");await page.getByLabel("Filter status").selectOption("ACTIVE");await page.getByLabel("Tag",{exact:true}).fill("VIP");await page.getByRole("button",{name:"Apply filters"}).click();await expect(page.getByText("1 customers found",{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Aisyah Updated Browser",exact:true})).toBeVisible();
  await page.getByLabel("Search",{exact:true}).fill("no-such-customer");await page.getByRole("button",{name:"Apply filters"}).click();await expect(page.getByText("No customers found",{exact:true})).toBeVisible();
  await page.getByLabel("Search",{exact:true}).fill("");await page.getByLabel("Filter status").selectOption("");await page.getByLabel("Tag",{exact:true}).fill("");await page.getByLabel("Per page").selectOption("10");await page.getByRole("button",{name:"Apply filters"}).click();await expect(page.getByText("11 customers found",{exact:true})).toBeVisible();await expect(page.getByText("Page 1 of 2",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Next",exact:true}).click();await expect(page.getByText("Page 2 of 2",{exact:true})).toBeVisible();await expect(page.getByRole("link",{name:"Aisyah Updated Browser",exact:true})).toBeVisible();
  expect((await context.request.get(`http://localhost:3101/api/tenants/${tenant.id}/customers/${customerId}`)).status()).toBe(200);
});

test("CRM Staff cannot edit profiles; Manager can; both can record follow-ups",async({page,context,browser})=>{
  await register(page,"role-owner");const tenant=await merchant(context,"CRM role merchant");const customer=await contact(context,tenant.id,"Role protected contact");
  for(const role of ["STAFF","MANAGER"]){
    const member=await browser.newContext();
    try{
      const memberPage=await member.newPage();const email=await register(memberPage,role.toLowerCase());
      const added=await context.request.post(`http://localhost:3101/api/tenants/${tenant.id}/members`,{headers,data:{email,role}});expect(added.status()).toBe(201);
      const switched=await member.request.post(`http://localhost:3101/api/tenants/${tenant.id}/switch`,{headers,data:{}});expect(switched.status()).toBe(201);
      await memberPage.goto("http://localhost:3101/crm");await expect(memberPage.getByTestId("crm-role")).toHaveText(role);
      await expect(memberPage.getByRole("link",{name:"New customer",exact:true})).toHaveCount(role==="STAFF"?0:1);
      await memberPage.getByRole("link",{name:"Role protected contact",exact:true}).click();await expect(memberPage.getByTestId("customer-name")).toHaveText("Role protected contact");
      if(role==="STAFF"){
        await expect(memberPage.getByRole("link",{name:"Edit customer",exact:true})).toHaveCount(0);
        await memberPage.goto(`http://localhost:3101/crm/${customer.id}/edit`);await expect(memberPage.getByText(/Only Owners and Managers can create or edit/)).toBeVisible();
        const write=await member.request.patch(`http://localhost:3101/api/tenants/${tenant.id}/customers/${customer.id}`,{headers,data:{notes:"forbidden"}});expect(write.status()).toBe(403);
        await memberPage.goto(`http://localhost:3101/crm/${customer.id}`);
      }else{
        await memberPage.getByRole("link",{name:"Edit customer",exact:true}).click();await memberPage.getByLabel("Notes",{exact:true}).fill("Manager added note");await memberPage.getByRole("button",{name:"Save customer",exact:true}).click();await expect(memberPage.getByText("Manager added note",{exact:true})).toBeVisible();
      }
      await memberPage.getByLabel("New follow-up").fill(`${role} contacted customer`);await memberPage.getByRole("button",{name:"Add follow-up",exact:true}).click();await expect(memberPage.getByText(`${role} contacted customer`,{exact:true})).toBeVisible();
    }finally{await member.close();}
  }
});

test("CRM tenant switching clears prior data and rejects forged customer IDs",async({page,context,browser})=>{
  await register(page,"isolation");const first=await merchant(context,"CRM First");const a=await contact(context,first.id,"Private contact Alpha");const second=await merchant(context,"CRM Second");const b=await contact(context,second.id,"Private contact Beta");
  await page.goto("/crm");await expect(page.getByRole("link",{name:b.name,exact:true})).toBeVisible();await expect(page.getByText(a.name,{exact:true})).toHaveCount(0);
  await page.getByLabel("CRM merchant").selectOption(first.id);await expect(page.getByRole("link",{name:a.name,exact:true})).toBeVisible();await expect(page.getByText(b.name,{exact:true})).toHaveCount(0);
  await page.goto(`/crm/${b.id}`);await expect(page.getByRole("alert").filter({hasText:"Customer not found"})).toBeVisible();await expect(page.getByTestId("customer-name")).toHaveCount(0);
  expect((await context.request.get(`http://localhost:3101/api/tenants/${first.id}/customers/${b.id}`)).status()).toBe(404);
  const outsider=await browser.newContext();try{
    const other=await outsider.newPage();await register(other,"outsider");
    expect((await outsider.request.get(`http://localhost:3101/api/tenants/${first.id}/customers`)).status()).toBe(403);
    expect((await outsider.request.post(`http://localhost:3101/api/tenants/${first.id}/customers/${a.id}/follow-ups`,{headers,data:{content:"malicious",tenantId:second.id}})).status()).toBe(403);
    await other.goto(`http://localhost:3101/crm/${a.id}`);await expect(other.getByTestId("customer-name")).toHaveCount(0);
  }finally{await outsider.close();}
});
