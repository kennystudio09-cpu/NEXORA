import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
const password = "Nexora-test-password-2026!";
async function register(page: Page, prefix: string) {
  const email = `${prefix}-${randomUUID()}@example.test`;
  await page.goto("/register");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Register", exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText(email, {exact:true})).toBeVisible();
  return email;
}
async function createMerchant(page: Page, name: string) {
  await page.getByLabel("Merchant name", {exact:true}).fill(name);
  await page.getByRole("button",{name:"Create merchant",exact:true}).click();
  await expect(page.getByTestId("merchant-name")).toHaveText(name);
}
test("registration, merchants, Dashboard, switching, sign out, login and stale cookie rejection",async ({page,context}) => {
  const email=await register(page,"browser-owner");
  await createMerchant(page,"Browser Merchant A");
  const first=await page.getByLabel("Active merchant").inputValue();
  await createMerchant(page,"Browser Merchant B");
  const second=await page.getByLabel("Active merchant").inputValue();
  expect(first).not.toEqual(second);
  await page.getByLabel("Active merchant").selectOption(first);
  await expect(page.getByTestId("merchant-name")).toHaveText("Browser Merchant A");
  await expect(page.getByTestId("merchant-role")).toHaveText("OWNER");
  await page.screenshot({path:"test-results/merchant-dashboard.png",fullPage:true});
  const cookies=await context.cookies();
  const old=cookies.find(c=>c.name==="nexora_session")!;
  expect(old.httpOnly).toBeTruthy();
  await page.getByRole("button",{name:"Sign out"}).click();
  await expect(page).toHaveURL(/login/);
  const replay=await page.request.get("http://localhost:4000/api/auth/me", {headers:{cookie:`nexora_session=${old.value}`}});
  expect(replay.status()).toBe(401);
  await page.getByLabel("Email",{exact:true}).fill(email);
  await page.getByLabel("Password",{exact:true}).fill(password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/dashboard/);
  await page.getByLabel("Active merchant").selectOption(second);
  await expect(page.getByTestId("merchant-name")).toHaveText("Browser Merchant B");
});
test("cross-tenant isolation and forged tenantId are denied through portal proxy",async({page,browser})=>{
  await register(page,"isolation-owner");
  await createMerchant(page,"Private merchant");
  const tenantId=await page.getByLabel("Active merchant").inputValue();
  const other=await browser.newContext();
  try {
    const outsider=await other.newPage(); await outsider.goto("http://localhost:3001/register");
    await outsider.getByLabel("Email",{exact:true}).fill(`outsider-${randomUUID()}@example.test`);
    await outsider.getByLabel("Password",{exact:true}).fill(password);await outsider.getByRole("button",{name:"Register",exact:true}).click();await expect(outsider).toHaveURL(/dashboard/);
    const read=await other.request.get(`http://localhost:3001/api/tenants/${tenantId}/dashboard`);expect(read.status()).toBe(403);
    const change=await other.request.post(`http://localhost:3001/api/tenants/${tenantId}/switch`,{headers:{"x-nexora-request":"1"},data:{tenantId}});expect(change.status()).toBe(403);
    const list=await other.request.get("http://localhost:3001/api/tenants");expect(await list.json()).toEqual([]);
    await expect(outsider.getByText("Private merchant",{exact:true})).toHaveCount(0);
  } finally { await other.close(); }
});
test("Owner, Manager and Staff permissions including forbidden UI actions",async({page,browser})=>{
  await register(page,"rbac-owner");await createMerchant(page,"Role controlled merchant");const tenantId=await page.getByLabel("Active merchant").inputValue();
  for(const role of ["MANAGER","STAFF"]){
    const context=await browser.newContext();
    try {
      const member=await context.newPage();await member.goto("http://localhost:3001/register");
      const email=`${role.toLowerCase()}-${randomUUID()}@example.test`;
      await member.getByLabel("Email",{exact:true}).fill(email);await member.getByLabel("Password",{exact:true}).fill(password);await member.getByRole("button",{name:"Register",exact:true}).click();await expect(member).toHaveURL(/dashboard/);
      await page.getByLabel("Team member email").fill(email);await page.getByLabel("Role",{exact:true}).selectOption(role);await page.getByRole("button",{name:"Add team member",exact:true}).click();await expect(page.getByRole("status")).toHaveText("Team member added");
      await member.reload();await member.getByLabel("Active merchant").selectOption(tenantId);await expect(member.getByTestId("merchant-role")).toHaveText(role);
      await expect(member.getByRole("button",{name:"Add team member",exact:true})).toHaveCount(0);
      const response=await context.request.post(`http://localhost:3001/api/tenants/${tenantId}/members`,{headers:{"x-nexora-request":"1"},data:{email,role:"STAFF"}});expect(response.status()).toBe(403);
      if(role==="STAFF"){
        await expect(member.getByRole("button",{name:"Save name",exact:true})).toHaveCount(0);
        expect((await context.request.patch(`http://localhost:3001/api/tenants/${tenantId}`,{headers:{"x-nexora-request":"1"},data:{name:"bad"}})).status()).toBe(403);
      }else{
        await member.getByLabel("New merchant name").fill("Manager edited merchant");await member.getByRole("button",{name:"Save name",exact:true}).click();await expect(member.getByTestId("merchant-name")).toHaveText("Manager edited merchant");
      }
    }finally{await context.close();}
  }
});
test("customer layout is responsive and platform administration denies ordinary accounts",async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await page.goto("http://localhost:3000/register");
  const email=`customer-${randomUUID()}@example.test`;
  await page.getByLabel("Email",{exact:true}).fill(email);await page.getByLabel("Password",{exact:true}).fill(password);await page.getByRole("button",{name:"Register",exact:true}).click();await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByRole("heading",{name:"Customer Portal",exact:true})).toBeVisible();
  await expect(page.getByRole("heading",{name:"Welcome to NEXORA",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBeTruthy();
  await page.screenshot({path:"test-results/customer-mobile.png",fullPage:true});
  await page.goto("http://localhost:3002/dashboard");
  await expect(page.getByRole("heading",{name:"Platform Admin",exact:true})).toBeVisible();
  await expect(page.getByRole("alert").filter({hasText:"Platform administrator access is required"})).toBeVisible();
  expect((await page.request.get("http://localhost:3002/api/platform/overview")).status()).toBe(403);
});
