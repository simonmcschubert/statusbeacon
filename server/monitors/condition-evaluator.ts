import { JSONPath } from 'jsonpath-plus';

export interface ConditionContext {
  STATUS?: number | string;
  RESPONSE_TIME?: number;
  CONNECTED?: boolean;
  BODY?: any;
  HEADERS?: Record<string, string>;
  CERTIFICATE_EXPIRATION?: string;
  DNS_RCODE?: string;
  ERROR?: string;
  TIMESTAMP?: string;
}

export class ConditionEvaluator {
  /**
   * Evaluate a single condition string against a context
   * Examples:
   * - "[STATUS] == 200"
   * - "[RESPONSE_TIME] < 500"
   * - "[BODY].status == 'healthy'"
   * - "[CONNECTED] == true"
   */
  static evaluate(condition: string, context: ConditionContext): boolean {
    try {
      // Replace placeholders with actual values
      let expression = condition;

      // Handle JSONPath for BODY (e.g., [BODY].data.status)
      const bodyPathMatch = condition.match(/\[BODY\](\.[\w.[\]]+)?/);
      if (bodyPathMatch && context.BODY) {
        const path = bodyPathMatch[1] || '';
        if (path) {
          // Use JSONPath to extract nested values
          const jsonPath = `$${path}`;
          try {
            const result = JSONPath({ path: jsonPath, json: context.BODY });
            const value = result && result.length > 0 ? result[0] : undefined;
            expression = expression.replace(bodyPathMatch[0], JSON.stringify(value));
          } catch {
            expression = expression.replace(bodyPathMatch[0], 'undefined');
          }
        } else {
          expression = expression.replace('[BODY]', JSON.stringify(context.BODY));
        }
      }

      // Replace other placeholders
      Object.entries(context).forEach(([key, value]) => {
        if (key !== 'BODY') {
          const placeholder = `[${key}]`;
          if (expression.includes(placeholder)) {
            expression = expression.replace(
              new RegExp(`\\[${key}\\]`, 'g'),
              JSON.stringify(value)
            );
          }
        }
      });

      // Evaluate the expression safely
      return this.evaluateExpression(expression);
    } catch (error) {
      console.error('Condition evaluation error:', error, 'Condition:', condition);
      return false;
    }
  }

  /**
   * Evaluate all conditions and return results
   */
  static evaluateAll(
    conditions: string[],
    context: ConditionContext
  ): { condition: string; success: boolean }[] {
    return conditions.map(condition => ({
      condition,
      success: this.evaluate(condition, context),
    }));
  }

  /**
   * Check if all conditions pass
   */
  static allPass(conditions: string[], context: ConditionContext): boolean {
    return conditions.every(condition => this.evaluate(condition, context));
  }

  /**
   * Safely evaluate a simple expression
   * Supports: ==, !=, >, <, >=, <=, contains
   */
  private static evaluateExpression(expression: string): boolean {
    // Remove extra whitespace
    expression = expression.trim();

    // Handle comparison operators
    const operators = ['==', '!=', '>=', '<=', '>', '<', 'contains', 'matches'];
    
    for (const op of operators) {
      if (expression.includes(op)) {
        const [left, right] = expression.split(op).map(s => s.trim());
        
        try {
          const leftValue = JSON.parse(left);
          const rightValue = JSON.parse(right);

          switch (op) {
            case '==':
              return leftValue == rightValue;
            case '!=':
              return leftValue != rightValue;
            case '>':
              return leftValue > rightValue;
            case '<':
              return leftValue < rightValue;
            case '>=':
              return leftValue >= rightValue;
            case '<=':
              return leftValue <= rightValue;
            case 'contains':
              return String(leftValue).includes(String(rightValue));
            case 'matches':
              return new RegExp(String(rightValue)).test(String(leftValue));
          }
        } catch {
          return false;
        }
      }
    }

    // If no operator found, try to parse as boolean
    try {
      return JSON.parse(expression) === true;
    } catch {
      return false;
    }
  }
}
