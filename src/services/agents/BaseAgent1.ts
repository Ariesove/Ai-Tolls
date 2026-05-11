interface BaseInterface {

}
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from "langchain/prompts";
import InitLLm from "./agentUtils"
const baseAgent = () => {
  // agent 初始化
  // 调度各个agent
  // prompt 拼接
  let llm = InitLLm();
  const template = "你作为最专业的前端工程师,你需要将整个输入的代码内容{{context}} 进行处理,通过之后的多个agent 进行处理";
  const promptA = new PromptTemplate({ template, inputVariables: ["context"] });
  
}
